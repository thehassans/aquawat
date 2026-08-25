/**
 * Lightweight inventory perf bench against a seeded tenant (§3.7).
 *
 * Usage:
 *   node scripts/benchInventoryPerf.js --tenant=<ObjectId> [--base=http://127.0.0.1:5000] [--token=...]
 *
 * Measures DB-side timings for transfer list / product count / moves / stock report aggregates
 * (no HTTP required when --db-only=1).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import InvTransfer from '../models/inventory/InvTransfer.js';
import InvMove from '../models/inventory/InvMove.js';
import InvQuant from '../models/inventory/InvQuant.js';
import Product from '../models/Product.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function timed(label, fn) {
  const t0 = process.hrtime.bigint();
  const result = await fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const meta = typeof result === 'object' && result && 'n' in result ? ` n=${result.n}` : '';
  console.log(`[bench] ${label}: ${ms.toFixed(1)}ms${meta}`);
  return { label, ms, ...((result && typeof result === 'object') ? result : {}) };
}

async function main() {
  const tenantId = arg('tenant', process.env.INV_PERF_TENANT_ID);
  if (!tenantId) {
    console.error('Required: --tenant=<ObjectId>');
    process.exit(1);
  }
  const tid = new mongoose.Types.ObjectId(tenantId);
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/maqder');

  const targets = {
    'transfer list < 300ms': 300,
    'product count < 500ms': 500,
    'moves sample < 500ms': 500,
    'stock quant group < 2000ms': 2000,
  };

  const results = [];
  results.push(await timed('transfer list', async () => {
    const items = await InvTransfer.find({ tenantId: tid })
      .sort({ scheduledDate: -1 })
      .limit(80)
      .select('name state scheduledDate operationTypeId origin')
      .lean();
    return { n: items.length };
  }));
  results.push(await timed('product count', async () => {
    const n = await Product.countDocuments({ tenantId: tid });
    return { n };
  }));
  results.push(await timed('moves sample', async () => {
    const items = await InvMove.find({ tenantId: tid })
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('reference state productId demandQty doneQty')
      .lean();
    return { n: items.length };
  }));
  results.push(await timed('stock quant group', async () => {
    const rows = await InvQuant.aggregate([
      { $match: { tenantId: tid } },
      { $group: { _id: '$productId', onHand: { $sum: '$quantityNum' } } },
      { $limit: 5000 },
    ]);
    return { n: rows.length };
  }));

  console.log('\n[bench] vs targets');
  const map = {
    'transfer list': 'transfer list < 300ms',
    'product count': 'product count < 500ms',
    'moves sample': 'moves sample < 500ms',
    'stock quant group': 'stock quant group < 2000ms',
  };
  let fail = 0;
  for (const r of results) {
    const key = map[r.label];
    const target = targets[key];
    const ok = r.ms <= target;
    if (!ok) fail += 1;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r.label}: ${r.ms.toFixed(1)}ms (target ${target}ms)`);
  }

  await mongoose.disconnect();
  process.exit(fail ? 2 : 0);
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* */ }
  process.exit(1);
});
