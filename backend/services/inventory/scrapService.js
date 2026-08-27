import { D, decStr, decIsPositive } from '../../utils/decimal.js';
import InvScrap from '../../models/inventory/InvScrap.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { nextSequenceName, ensureSequence } from './sequence.js';
import { applyQuantDelta } from './quantDelta.js';
import { runWithTransaction } from './reserve.js';
import { getDefaultUom } from './bootstrap.js';
import { InventoryValidationError } from './errors.js';
import { computeMoveDoneChecksum, computeMoveLineDoneChecksum } from './doneChecksum.js';
import { getInvSettings } from './settingsService.js';

async function resolveScrapLocation(tid, scrapLocationId) {
  if (scrapLocationId) {
    const loc = await InvLocation.findOne({
      _id: scrapLocationId,
      tenantId: tid,
      active: true,
      $or: [{ isScrapLocation: true }, { usage: 'scrap' }],
    });
    if (!loc) throw new InventoryValidationError('Invalid scrap location', 'BAD_SCRAP_LOC');
    return loc._id;
  }
  const scrapLoc = await InvLocation.findOne({
    tenantId: tid,
    $or: [{ isScrapLocation: true }, { usage: 'scrap' }],
    active: true,
  });
  if (!scrapLoc) throw new InventoryValidationError('Scrap location not found', 'NO_SCRAP_LOC');
  return scrapLoc._id;
}

async function buildScrapDoc(tid, userId, body, scrapLocationId, defaultUom) {
  const product = await Product.findOne({ _id: body.productId, tenantId: tid });
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

  const uomId = body.uomId || product.uomId || defaultUom?._id;
  if (!uomId) throw new InventoryValidationError('UoM required', 'NO_UOM');
  if (!body.sourceLocationId && !body.locationId) {
    throw new InventoryValidationError('sourceLocationId required', 'NO_LOCATION');
  }
  if (!decIsPositive(body.quantity)) {
    throw new InventoryValidationError('quantity must be positive', 'BAD_QTY');
  }

  if (body.variantId) {
    const { default: InvProductVariant } = await import('../../models/inventory/InvProductVariant.js');
    const variant = await InvProductVariant.findOne({
      _id: body.variantId,
      tenantId: tid,
      productId: product._id,
      active: true,
    }).lean();
    if (!variant) throw new InventoryValidationError('Variant not found', 'VARIANT_NOT_FOUND');
  }

  const name = await nextSequenceName(tid, 'SCR');
  return {
    tenantId: tid,
    name,
    productId: product._id,
    variantId: body.variantId || null,
    uomId,
    quantity: decStr(body.quantity),
    lotId: body.lotId || null,
    packageId: body.packageId || null,
    sourceLocationId: body.sourceLocationId || body.locationId,
    scrapLocationId,
    transferId: body.transferId || null,
    reasonTag: body.reasonTag || body.scrapReasonTag,
    note: body.note,
    sourceDocument: body.sourceDocument || body.origin || '',
    date: body.date ? new Date(body.date) : new Date(),
    responsibleId: body.responsibleId || userId,
    state: 'draft',
    createdBy: userId,
  };
}

export async function createScrap(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  await ensureSequence(tid, 'SCR', 'SCR');

  const scrapLocationId = await resolveScrapLocation(tid, body.scrapLocationId);
  const defaultUom = await getDefaultUom(tid);

  // Multi-line: create one scrap document per line sharing header fields
  const lineBodies = Array.isArray(body.lines) && body.lines.length
    ? body.lines.map((line) => ({
      ...line,
      sourceLocationId: line.sourceLocationId || body.sourceLocationId || body.locationId,
      scrapLocationId,
      date: line.date || body.date,
      reasonTag: line.reasonTag || body.reasonTag || body.scrapReasonTag,
      note: line.note || body.note,
      sourceDocument: line.sourceDocument || body.sourceDocument || body.origin || '',
      transferId: body.transferId,
      responsibleId: body.responsibleId,
    }))
    : [body];

  const docs = [];
  for (const line of lineBodies) {
    docs.push(await buildScrapDoc(tid, userId, line, scrapLocationId, defaultUom));
  }

  const created = await InvScrap.create(docs);
  if (Array.isArray(body.lines) && body.lines.length) {
    return { items: created, count: created.length };
  }
  return created[0];
}

export async function validateScrapsBulk(tenantId, ids = [], userId = null) {
  const results = [];
  for (const id of ids) {
    try {
      const scrap = await validateScrap(id, tenantId, userId);
      results.push({ id, ok: true, scrap });
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err?.message || String(err),
        code: err?.code,
      });
    }
  }
  return {
    results,
    okCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
  };
}

/**
 * Validate scrap — move qty from internal → scrap via move ledger.
 */
export async function validateScrap(scrapId, tenantId, userId = null) {
  return runWithTransaction(async (session) => {
    const tid = toObjectId(tenantId);
    const scrap = await InvScrap.findOne({ _id: scrapId, tenantId: tid }).session(session);
    if (!scrap) throw new InventoryValidationError('Scrap not found', 'SCRAP_NOT_FOUND');
    if (scrap.state === 'done') return scrap;

    const settings = await getInvSettings(tid);
    const product = await Product.findById(scrap.productId).session(session);
    if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

    const qty = decStr(scrap.quantity);
    if (!decIsPositive(qty)) {
      throw new InventoryValidationError('quantity must be positive', 'BAD_QTY');
    }

    const now = scrap.date || new Date();

    let allowNegative = !!settings.allowNegativeStock;
    if (!allowNegative && product.categoryId) {
      const { default: InvProductCategory } = await import('../../models/inventory/InvProductCategory.js');
      const cat = await InvProductCategory.findById(product.categoryId).session(session).lean();
      allowNegative = !!cat?.allowNegativeStock;
    } else if (!allowNegative && product.allowNegativeStock) {
      allowNegative = true;
    }

    const [move] = await InvMove.create([{
      tenantId: tid,
      reference: scrap.name,
      origin: scrap.name,
      productId: scrap.productId,
      variantId: scrap.variantId || null,
      uomId: scrap.uomId,
      demandQty: qty,
      doneQty: qty,
      sourceLocationId: scrap.sourceLocationId,
      destLocationId: scrap.scrapLocationId,
      state: 'done',
      date: now,
      doneAt: now,
      doneChecksum: computeMoveDoneChecksum({
        productId: scrap.productId,
        demandQty: qty,
        doneQty: qty,
        sourceLocationId: scrap.sourceLocationId,
        destLocationId: scrap.scrapLocationId,
        uomId: scrap.uomId,
        transferId: scrap.transferId || null,
      }),
      isScrapped: true,
      transferId: scrap.transferId || null,
      createdBy: scrap.createdBy,
    }], { session });

    await InvMoveLine.create([{
      tenantId: tid,
      moveId: move._id,
      transferId: scrap.transferId || null,
      productId: scrap.productId,
      variantId: scrap.variantId || null,
      uomId: scrap.uomId,
      quantity: qty,
      quantityInProductUom: qty,
      sourceLocationId: scrap.sourceLocationId,
      destLocationId: scrap.scrapLocationId,
      lotId: scrap.lotId || null,
      packageId: scrap.packageId || null,
      state: 'done',
      doneAt: now,
      doneChecksum: computeMoveLineDoneChecksum({
        moveId: move._id,
        productId: scrap.productId,
        quantity: qty,
        quantityInProductUom: qty,
        sourceLocationId: scrap.sourceLocationId,
        destLocationId: scrap.scrapLocationId,
        lotId: scrap.lotId || null,
        packageId: scrap.packageId || null,
      }),
      reference: scrap.name,
      createdBy: scrap.createdBy,
    }], { session });

    const dims = {
      variantId: scrap.variantId || null,
      lotId: scrap.lotId || null,
      packageId: scrap.packageId || null,
      ownerId: null,
      tracking: product?.tracking,
      allowNegative,
    };

    await applyQuantDelta(
      session,
      tid,
      scrap.productId,
      scrap.sourceLocationId,
      decStr(D(qty).neg()),
      '0',
      now,
      dims,
    );

    // Inventory evaluation on scrap (out) when costing / full accounting
    let valuationJob = null;
    const { isInventoryEvaluationOn } = await import('./accountingMode.js');
    if (isInventoryEvaluationOn(settings)) {
      try {
        const { createValuationForMove } = await import('./valuation.js');
        const val = await createValuationForMove(session, {
          tenantId: tid,
          productId: scrap.productId,
          quantity: qty,
          moveId: move._id,
          direction: 'out',
          description: `Scrap ${scrap.name}`,
          evaluationEnabled: true,
        });
        if (val?.layer) {
          valuationJob = {
            layerId: val.layer._id,
            direction: val.direction || 'out',
            valuationMode: val.valuationMode,
            productId: scrap.productId,
            locationId: scrap.sourceLocationId,
          };
        }
      } catch (err) {
        console.error('[inventory] scrap valuation failed', err?.message || err);
      }
    }

    scrap.state = 'done';
    scrap.moveId = move._id;
    await scrap.save({ session });
    return { scrap, valuationJob };
  }).then(async (result) => {
    const scrap = result?.scrap || result;
    if (!scrap?.productId) return scrap;
    if (result?.valuationJob) {
      try {
        const { postValuationLayerJournal } = await import('./stockAccounting.js');
        const job = result.valuationJob;
        await postValuationLayerJournal({
          tenantId,
          userId: userId || scrap.createdBy || scrap.responsibleId || null,
          layerId: job.layerId,
          direction: job.direction,
          valuationMode: job.valuationMode,
          productId: job.productId,
          locationId: job.locationId,
        });
      } catch (err) {
        console.error('[inventory] scrap valuation journal failed', err?.message || err);
      }
    }
    try {
      const { syncProductsStockCache } = await import('./syncProductCache.js');
      await syncProductsStockCache(tenantId, [scrap.productId]);
    } catch (err) {
      console.error('[inventory] scrap product cache sync failed', err?.message || err);
    }
    return scrap;
  });
}

export async function listScraps(tenantId, { state, page = 1, limit = 40 } = {}) {
  const filter = { tenantId: toObjectId(tenantId) };
  if (state) filter.state = state;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    InvScrap.find(filter)
      .populate('productId', 'nameEn nameAr sku unitOfMeasure')
      .populate('variantId', 'name sku')
      .populate('uomId', 'name nameAr')
      .populate('sourceLocationId', 'name completePath')
      .populate('scrapLocationId', 'name completePath')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    InvScrap.countDocuments(filter),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
}
