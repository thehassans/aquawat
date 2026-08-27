/**
 * Migrate corrupted stock.quant rows that sit on Product Templates which have
 * active variants (template-level physical stock is illegal in enterprise ERP).
 *
 * Strategies:
 *   --bind-single   If the template has exactly one active variant, rebind the
 *                   null-variant quant onto that variant (merge if needed).
 *   --to-adj        Move quantity to the Inventory Adjustment (inventoryLoss)
 *                   location and zero the internal/warehouse quant so staff can
 *                   re-receive against specific SKUs. Used when multiple variants.
 *
 * Default: --bind-single when possible, otherwise --to-adj.
 *
 * Usage (from backend/, MONGO_URI set):
 *   node scripts/migrateTemplateQuants.js --dry-run
 *   node scripts/migrateTemplateQuants.js --dry-run --tenant=<tenantId>
 *   node scripts/migrateTemplateQuants.js --apply
 *   node scripts/migrateTemplateQuants.js --apply --tenant=<tenantId>
 *   node scripts/migrateTemplateQuants.js --apply --force-adj   # never bind; always scrap to adj
 */
import mongoose from 'mongoose';
import { setDecimalPair } from '../models/inventory/common.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--apply');
const forceAdj = args.includes('--force-adj');
const tenantArg = args.find((a) => a.startsWith('--tenant='));
const tenantFilterId = tenantArg ? tenantArg.split('=')[1] : null;

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!uri) {
  console.error('Set MONGO_URI (or MONGODB_URI / DATABASE_URL) before running.');
  process.exit(1);
}

function oid(id) {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function qtyOf(q) {
  return Number(q?.quantity ?? q?.quantityNum ?? 0) || 0;
}

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(dryRun ? 'MODE: dry-run (no writes)' : 'MODE: apply');
  if (forceAdj) console.log('STRATEGY: force inventoryLoss for all');

  const products = db.collection('products');
  const variants = db.collection('invproductvariants');
  const quants = db.collection('invquants');
  const locations = db.collection('invlocations');

  const tenantMatch = tenantFilterId ? { tenantId: oid(tenantFilterId) } : {};

  // Templates that declare attribute lines OR have >0 active non-default variants
  const attributedProducts = await products.find({
    ...tenantMatch,
    'attributeLines.0': { $exists: true },
  }).project({ _id: 1, nameEn: 1, sku: 1, tenantId: 1, attributeLines: 1 }).toArray();

  const productIdsFromAttrs = new Set(attributedProducts.map((p) => String(p._id)));

  const variantAgg = await variants.aggregate([
    { $match: { ...tenantMatch, active: true } },
    {
      $group: {
        _id: { tenantId: '$tenantId', productId: '$productId' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        nonDefault: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$isDefault', true] },
                  { $ne: ['$combinationKey', 'default'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $match: { $or: [{ count: { $gt: 1 } }, { nonDefault: { $gt: 0 } }] } },
  ]).toArray();

  const variantMeta = new Map();
  for (const row of variantAgg) {
    const pid = String(row._id.productId);
    productIdsFromAttrs.add(pid);
    variantMeta.set(pid, {
      tenantId: row._id.tenantId,
      count: row.count,
      ids: row.ids,
      nonDefault: row.nonDefault,
    });
  }

  // Fill meta for attr-only products
  for (const p of attributedProducts) {
    const pid = String(p._id);
    if (variantMeta.has(pid)) continue;
    const vs = await variants.find({
      tenantId: p.tenantId,
      productId: p._id,
      active: true,
    }).project({ _id: 1 }).toArray();
    variantMeta.set(pid, {
      tenantId: p.tenantId,
      count: vs.length,
      ids: vs.map((v) => v._id),
      nonDefault: vs.length,
    });
  }

  const targetProductOids = [...productIdsFromAttrs].map(oid).filter(Boolean);
  if (!targetProductOids.length) {
    console.log('No attributed / multi-variant products found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const badQuants = await quants.find({
    ...tenantMatch,
    productId: { $in: targetProductOids },
    $or: [{ variantId: null }, { variantId: { $exists: false } }],
  }).toArray();

  console.log(`Found ${badQuants.length} template-level quant(s) on products with variants`);

  const adjLocByTenant = new Map();
  async function getAdjLoc(tenantId) {
    const key = String(tenantId);
    if (adjLocByTenant.has(key)) return adjLocByTenant.get(key);
    let loc = await locations.findOne({ tenantId, usage: 'inventoryLoss' });
    if (!loc && !dryRun) {
      console.warn(`No inventoryLoss location for tenant ${key} — skip adj moves`);
    }
    adjLocByTenant.set(key, loc);
    return loc;
  }

  const productCache = new Map(attributedProducts.map((p) => [String(p._id), p]));
  let bound = 0;
  let movedAdj = 0;
  let zeroed = 0;
  let skipped = 0;

  for (const q of badQuants) {
    const pid = String(q.productId);
    const meta = variantMeta.get(pid) || { count: 0, ids: [] };
    const product = productCache.get(pid) || await products.findOne({ _id: q.productId });
    const qty = qtyOf(q);
    const reserved = Number(q.reservedQuantity ?? 0) || 0;
    const label = product?.nameEn || product?.sku || pid;

    if (qty === 0 && reserved === 0) {
      console.log(`  SKIP empty quant ${q._id} · ${label}`);
      skipped += 1;
      // Still delete orphan zero rows on apply? keep for uniqueness — leave
      continue;
    }

    const canBind = !forceAdj && meta.count === 1 && meta.ids[0];
    if (canBind) {
      const targetVariantId = meta.ids[0];
      console.log(
        `  BIND ${qty} of "${label}" quant=${q._id} → variant ${targetVariantId}`
        + (dryRun ? ' [dry]' : ''),
      );
      if (!dryRun) {
        const existing = await quants.findOne({
          tenantId: q.tenantId,
          productId: q.productId,
          variantId: targetVariantId,
          locationId: q.locationId,
          lotId: q.lotId || null,
          packageId: q.packageId || null,
          ownerId: q.ownerId || null,
        });
        if (existing) {
          const nextQty = qtyOf(existing) + qty;
          const nextRes = (Number(existing.reservedQuantity ?? 0) || 0) + reserved;
          const patch = {};
          setDecimalPair(patch, 'quantity', String(nextQty));
          setDecimalPair(patch, 'reservedQuantity', String(nextRes));
          await quants.updateOne({ _id: existing._id }, { $set: patch });
          await quants.deleteOne({ _id: q._id });
        } else {
          await quants.updateOne(
            { _id: q._id },
            { $set: { variantId: targetVariantId } },
          );
        }
      }
      bound += 1;
      continue;
    }

    // Move to inventory adjustment location
    const adj = await getAdjLoc(q.tenantId);
    if (!adj) {
      console.warn(`  WARN no adj loc — cannot move "${label}" quant=${q._id}`);
      skipped += 1;
      continue;
    }

    console.log(
      `  ADJ  ${qty} of "${label}" quant=${q._id} loc→inventoryLoss (${adj._id})`
      + (dryRun ? ' [dry]' : ''),
    );

    if (!dryRun) {
      // Upsert holding quant on inventoryLoss (null variant — quarantine only)
      const holdFilter = {
        tenantId: q.tenantId,
        productId: q.productId,
        variantId: null,
        locationId: adj._id,
        lotId: q.lotId || null,
        packageId: q.packageId || null,
        ownerId: q.ownerId || null,
      };
      const hold = await quants.findOne(holdFilter);
      if (hold) {
        const patch = {};
        setDecimalPair(patch, 'quantity', String(qtyOf(hold) + qty));
        await quants.updateOne({ _id: hold._id }, { $set: patch });
      } else {
        const doc = {
          ...holdFilter,
          inventoryStatus: 'on_hold',
          statusReason: 'Migrated from template-level quant (variant required)',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setDecimalPair(doc, 'quantity', String(qty));
        setDecimalPair(doc, 'reservedQuantity', '0');
        setDecimalPair(doc, 'value', '0');
        await quants.insertOne(doc);
      }

      // Zero / remove source warehouse quant
      if (String(q.locationId) === String(adj._id)) {
        // already on adj — just leave as hold
      } else {
        const zero = {};
        setDecimalPair(zero, 'quantity', '0');
        setDecimalPair(zero, 'reservedQuantity', '0');
        await quants.updateOne({ _id: q._id }, { $set: zero });
        // Optional: delete empty source
        await quants.deleteOne({ _id: q._id });
      }
    }
    movedAdj += 1;
    zeroed += 1;
  }

  console.log('---');
  console.log(`Bound to single variant: ${bound}`);
  console.log(`Moved to inventoryLoss:  ${movedAdj}`);
  console.log(`Skipped:                 ${skipped}`);
  console.log(dryRun
    ? 'Dry-run complete. Re-run with --apply to write.'
    : 'Apply complete.');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
