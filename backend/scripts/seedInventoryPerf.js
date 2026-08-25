/**
 * Inventory performance seed (§3.7).
 *
 * Usage:
 *   node scripts/seedInventoryPerf.js --tenant=<ObjectId> [--profile=smoke|brief|full]
 *
 * Profiles:
 *   smoke  — 2 WH, 500 products, 1k list transfers, 100 validated receipts (default)
 *   brief  — 10 WH, 50k products, 200k list transfers, 5k validated receipts
 *   full   — same sizes as brief but validates ALL receipt moves via the engine (slow)
 *
 * Stock always goes through createTransfer → confirm → validate (never direct quant writes).
 * List-benchmark transfers are draft/confirmed shells without stock impact.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Warehouse from '../models/Warehouse.js';
import Product from '../models/Product.js';
import InvTransfer from '../models/inventory/InvTransfer.js';
import InvMove from '../models/inventory/InvMove.js';
import InvOperationType from '../models/inventory/InvOperationType.js';
import { ensureInventoryBootstrap, bootstrapWarehouse, getDefaultUom, enableEngine } from '../services/inventory/bootstrap.js';
import { createTransfer } from '../services/inventory/createTransfer.js';
import { confirmTransfer, validateTransfer } from '../services/inventory/transferService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PROFILES = {
  smoke: {
    warehouses: 2,
    products: 500,
    listTransfers: 1000,
    validatedReceipts: 100,
  },
  brief: {
    warehouses: 10,
    products: 50_000,
    listTransfers: 200_000,
    validatedReceipts: 5_000,
  },
  full: {
    warehouses: 10,
    products: 50_000,
    listTransfers: 200_000,
    validatedReceipts: 200_000,
  },
};

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function log(...args) {
  console.log('[inv-perf-seed]', ...args);
}

async function bulkInsert(Model, docs, batchSize = 1000) {
  let inserted = 0;
  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    try {
      await Model.insertMany(chunk, { ordered: false });
      inserted += chunk.length;
    } catch (err) {
      inserted += err?.insertedDocs?.length || err?.result?.nInserted || 0;
      if (!err?.writeErrors && err?.code !== 11000) throw err;
    }
    if ((i / batchSize) % 10 === 0) log(`… ${Model.modelName} ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
  }
  return inserted;
}

async function main() {
  const tenantId = arg('tenant', process.env.INV_PERF_TENANT_ID);
  const profileName = arg('profile', process.env.INV_PERF_PROFILE || 'smoke');
  const profile = PROFILES[profileName];
  if (!tenantId) {
    console.error('Required: --tenant=<ObjectId> or INV_PERF_TENANT_ID');
    process.exit(1);
  }
  if (!profile) {
    console.error(`Unknown profile ${profileName}. Use smoke|brief|full`);
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/maqder';
  await mongoose.connect(uri);
  const tid = new mongoose.Types.ObjectId(tenantId);
  log(`tenant=${tid} profile=${profileName}`, profile);

  await ensureInventoryBootstrap(tid);
  try {
    await enableEngine(tid);
  } catch {
    /* may already be on */
  }
  const uom = await getDefaultUom(tid);

  // ── Warehouses ───────────────────────────────────────────────────
  const warehouses = [];
  for (let i = 1; i <= profile.warehouses; i += 1) {
    const code = `PERF-WH-${String(i).padStart(2, '0')}`;
    let wh = await Warehouse.findOne({ tenantId: tid, code });
    if (!wh) {
      wh = await Warehouse.create({
        tenantId: tid,
        code,
        nameEn: `Perf Warehouse ${i}`,
        nameAr: `مستودع أداء ${i}`,
        type: i === 1 ? 'main' : 'branch',
        isActive: true,
        isPrimary: i === 1,
      });
    }
    if (!wh.stockLocationId) {
      await bootstrapWarehouse(tid, wh, null, null);
      wh = await Warehouse.findById(wh._id);
    }
    warehouses.push(wh);
  }
  log(`warehouses=${warehouses.length}`);

  // ── Products (bulk) ──────────────────────────────────────────────
  const existingProducts = await Product.countDocuments({
    tenantId: tid,
    sku: { $regex: /^PERF-/ },
  });
  const needProducts = Math.max(0, profile.products - existingProducts);
  if (needProducts > 0) {
    const docs = [];
    const start = existingProducts + 1;
    for (let i = 0; i < needProducts; i += 1) {
      const n = start + i;
      const wh = warehouses[n % warehouses.length];
      docs.push({
        tenantId: tid,
        sku: `PERF-${String(n).padStart(6, '0')}`,
        nameEn: `Perf Product ${n}`,
        nameAr: `منتج أداء ${n}`,
        sellingPrice: 10 + (n % 90),
        costPrice: 5 + (n % 40),
        trackInventory: true,
        status: 'active',
        uomId: uom?._id,
        productType: 'goods',
        totalStock: 0,
        stocks: [{ warehouseId: wh._id, quantity: 0 }],
      });
    }
    const n = await bulkInsert(Product, docs, 2000);
    log(`products inserted≈${n} (target ${profile.products})`);
  } else {
    log(`products already ≥ ${profile.products}`);
  }

  const productIds = await Product.find({ tenantId: tid, sku: { $regex: /^PERF-/ } })
    .select('_id')
    .limit(profile.products)
    .lean();

  // ── List-benchmark transfers (no stock) ──────────────────────────
  const existingList = await InvTransfer.countDocuments({
    tenantId: tid,
    origin: { $regex: /^PERF-LIST-/ },
  });
  const needList = Math.max(0, profile.listTransfers - existingList);
  if (needList > 0) {
    const opTypes = await InvOperationType.find({
      tenantId: tid,
      warehouseId: { $in: warehouses.map((w) => w._id) },
      code: 'incoming',
      active: true,
    }).lean();
    if (!opTypes.length) throw new Error('No incoming operation types — bootstrap warehouses first');

    const states = ['draft', 'confirmed', 'assigned', 'done', 'cancelled'];
    const docs = [];
    const moveDocs = [];
    const start = existingList + 1;
    for (let i = 0; i < needList; i += 1) {
      const n = start + i;
      const ot = opTypes[n % opTypes.length];
      const pid = productIds[n % productIds.length]._id;
      const id = new mongoose.Types.ObjectId();
      const state = states[n % states.length];
      docs.push({
        _id: id,
        tenantId: tid,
        name: `PERF-LIST/${String(n).padStart(7, '0')}`,
        operationTypeId: ot._id,
        sourceLocationId: ot.defaultSourceLocationId,
        destLocationId: ot.defaultDestLocationId || ot.defaultSourceLocationId,
        scheduledDate: new Date(Date.now() - (n % 90) * 86400000),
        origin: `PERF-LIST-${n}`,
        state,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      moveDocs.push({
        tenantId: tid,
        reference: `PERF-LIST/${String(n).padStart(7, '0')}`,
        origin: `PERF-LIST-${n}`,
        productId: pid,
        uomId: uom._id,
        demandQty: String(1 + (n % 20)),
        demandQtyNum: 1 + (n % 20),
        doneQty: state === 'done' ? String(1 + (n % 20)) : '0',
        doneQtyNum: state === 'done' ? 1 + (n % 20) : 0,
        sourceLocationId: ot.defaultSourceLocationId,
        destLocationId: ot.defaultDestLocationId || ot.defaultSourceLocationId,
        state: state === 'done' ? 'done' : (state === 'cancelled' ? 'cancelled' : 'confirmed'),
        transferId: id,
        date: new Date(),
      });
    }
    await bulkInsert(InvTransfer, docs, 2000);
    await bulkInsert(InvMove, moveDocs, 2000);
    log(`list transfers inserted≈${needList}`);
  } else {
    log(`list transfers already ≥ ${profile.listTransfers}`);
  }

  // ── Validated receipts (engine path — real stock) ────────────────
  const existingVal = await InvTransfer.countDocuments({
    tenantId: tid,
    origin: { $regex: /^PERF-VAL-/ },
  });
  const needVal = Math.max(0, profile.validatedReceipts - existingVal);
  if (needVal > 0) {
    const opByWh = new Map();
    for (const wh of warehouses) {
      const ot = await InvOperationType.findOne({
        tenantId: tid,
        warehouseId: wh._id,
        code: 'incoming',
        active: true,
      });
      if (ot) opByWh.set(String(wh._id), ot);
    }
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < needVal; i += 1) {
      const n = existingVal + i + 1;
      const wh = warehouses[n % warehouses.length];
      const ot = opByWh.get(String(wh._id));
      const product = productIds[n % productIds.length];
      if (!ot || !product) {
        fail += 1;
        continue;
      }
      try {
        const transfer = await createTransfer(tid, {
          operationTypeId: ot._id,
          sourceLocationId: ot.defaultSourceLocationId,
          destLocationId: ot.defaultDestLocationId || wh.stockLocationId,
          origin: `PERF-VAL-${n}`,
          note: 'perf seed validated receipt',
          lines: [{ productId: product._id, demandQty: String(1 + (n % 10)) }],
        });
        await confirmTransfer(tid, transfer._id);
        await validateTransfer(tid, transfer._id, {
          immediate: true,
          createBackorder: 'never',
        });
        ok += 1;
      } catch (err) {
        fail += 1;
        if (fail <= 5) log('validate error', err.message);
      }
      if ((i + 1) % 50 === 0) log(`validated ${ok}/${needVal} (fail=${fail})`);
    }
    log(`validated receipts ok=${ok} fail=${fail}`);
  } else {
    log(`validated receipts already ≥ ${profile.validatedReceipts}`);
  }

  log('done');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* */ }
  process.exit(1);
});
