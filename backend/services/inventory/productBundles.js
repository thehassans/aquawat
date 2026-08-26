import Product from '../../models/Product.js';
import InvProductBundle from '../../models/inventory/InvProductBundle.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { D, decStr } from '../../utils/decimal.js';

export async function getBundle(tenantId, productId) {
  return InvProductBundle.findOne({
    tenantId: toObjectId(tenantId),
    productId: toObjectId(productId),
  })
    .populate('lines.componentProductId', 'nameEn nameAr sku productId')
    .populate('lines.componentVariantId', 'name sku barcode')
    .lean();
}

export async function upsertBundle(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  const productId = toObjectId(body.productId);
  const type = body.type === 'set' ? 'set' : 'kit';

  const product = await Product.findOne({ _id: productId, tenantId: tid });
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');

  const lines = (body.lines || []).map((l, i) => {
    const componentProductId = toObjectId(l.componentProductId);
    if (String(componentProductId) === String(productId)) {
      throw new InventoryValidationError('Bundle cannot include itself', 'BUNDLE_SELF');
    }
    return {
      componentProductId,
      componentVariantId: l.componentVariantId ? toObjectId(l.componentVariantId) : null,
      qty: decStr(l.qty || '1'),
      sequence: Number(l.sequence) || (i + 1) * 10,
    };
  });

  if (!lines.length) {
    throw new InventoryValidationError('Bundle needs at least one component', 'BUNDLE_EMPTY');
  }

  // One level only — refuse if any component is itself a kit
  const componentIds = lines.map((l) => l.componentProductId);
  const nested = await InvProductBundle.find({
    tenantId: tid,
    productId: { $in: componentIds },
    active: true,
    type: 'kit',
  }).lean();
  if (nested.length) {
    throw new InventoryValidationError(
      'Nested kits are not supported — use Manufacturing for BoM',
      'BUNDLE_NESTED',
    );
  }

  const doc = await InvProductBundle.findOneAndUpdate(
    { tenantId: tid, productId },
    {
      $set: {
        type,
        lines,
        active: body.active !== false,
        updatedBy: userId,
      },
      $setOnInsert: {
        tenantId: tid,
        productId,
        createdBy: userId,
      },
    },
    { upsert: true, new: true },
  );

  if (type === 'kit') {
    product.productType = product.productType === 'service' ? product.productType : 'goods';
    product.trackInventory = false;
    await product.save();
  }

  return doc;
}

/**
 * Kit availability = min over components of floor(available / requiredQty).
 */
export async function kitAvailability(tenantId, productId, { warehouseId } = {}) {
  const bundle = await getBundle(tenantId, productId);
  if (!bundle || !bundle.active) {
    return { available: null, reason: 'NO_BUNDLE' };
  }
  if (bundle.type !== 'kit') {
    return { available: null, reason: 'NOT_KIT', type: bundle.type };
  }

  const { computeForecast } = await import('./forecast.js');
  let minAvail = null;
  const components = [];

  for (const line of bundle.lines || []) {
    const pid = line.componentProductId?._id || line.componentProductId;
    const vid = line.componentVariantId?._id || line.componentVariantId || null;
    const need = D(line.qty || '1');
    // eslint-disable-next-line no-await-in-loop
    const fc = await computeForecast(tenantId, pid, {
      variantId: vid || undefined,
      warehouseId: warehouseId || undefined,
    });
    const onHand = D(fc.onHand || '0');
    const canMake = need.gt(0) ? onHand.div(need).floor() : D(0);
    components.push({
      productId: pid,
      variantId: vid,
      requiredQty: decStr(need),
      onHand: decStr(onHand),
      canMake: decStr(canMake),
    });
    if (minAvail == null || canMake.lt(minAvail)) minAvail = canMake;
  }

  return {
    type: 'kit',
    available: decStr(minAvail || 0),
    components,
  };
}
