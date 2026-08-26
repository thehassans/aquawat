/**
 * Repair inventory audit tenants on a live DB:
 *  - unlock + reset passwords (bcrypt plaintext)
 *  - promote A admin to role=admin
 *  - fix MAIN/WH2 input/output location pointers for 1-step / 2-step
 *  - seed opening stock (100) for simple SKUs on MAIN/Stock
 *
 * Usage (inside backend container after git pull / docker cp):
 *   node scripts/fixInventoryAuditPasswords.js
 *   node scripts/fixInventoryAuditPasswords.js --password='YourPass!'
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import Warehouse from '../models/Warehouse.js';
import Product from '../models/Product.js';
import InvLocation from '../models/inventory/InvLocation.js';
import { applyQuantDelta } from '../services/inventory/quantDelta.js';
import { createLocation } from '../services/inventory/configMasters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const EMAILS = [
  'admin@inv-audit-a.test',
  'operator@inv-audit-a.test',
  'admin@inv-audit-b.test',
];

function arg(name, fallback) {
  const flag = `--${name}`;
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  return fallback;
}

async function ensureChild(tid, userId, parent, name, nameAr, warehouseId) {
  const completePath = `${parent.completePath}/${name}`;
  let loc = await InvLocation.findOne({ tenantId: tid, completePath });
  if (!loc) {
    loc = await createLocation(tid, userId, {
      name,
      nameAr,
      usage: 'internal',
      parentId: parent._id,
      warehouseId,
    });
  }
  return loc;
}

async function fixWarehousePointers(tid, userId, code, receptionSteps, deliverySteps) {
  const wh = await Warehouse.findOne({ tenantId: tid, code });
  if (!wh) return { code, status: 'missing' };
  wh.receptionSteps = receptionSteps;
  wh.deliverySteps = deliverySteps;
  const view = await InvLocation.findById(wh.viewLocationId);
  const stock = await InvLocation.findById(wh.stockLocationId);
  if (!view || !stock) {
    await wh.save();
    return { code, status: 'missing_locations' };
  }
  const input = await ensureChild(tid, userId, view, 'Input', 'المدخل', wh._id);
  const output = await ensureChild(tid, userId, view, 'Output', 'المخرج', wh._id);
  wh.inputLocationId = receptionSteps === 'one' ? stock._id : input._id;
  wh.outputLocationId = deliverySteps === 'ship' ? stock._id : output._id;
  await wh.save();
  return {
    code,
    status: 'ok',
    receptionSteps,
    deliverySteps,
    stock: stock.completePath,
    input: (await InvLocation.findById(wh.inputLocationId))?.completePath,
    output: (await InvLocation.findById(wh.outputLocationId))?.completePath,
  };
}

async function seedOpeningStock(tid, stockLocationId) {
  const InvQuant = (await import('../models/inventory/InvQuant.js')).default;
  const simples = await Product.find({ tenantId: tid, sku: /^AUD-SIM-/, tracking: 'none' });
  if (!simples.length || !stockLocationId) return { seeded: 0 };
  let seeded = 0;
  for (const p of simples) {
    const existing = await InvQuant.findOne({
      tenantId: tid,
      productId: p._id,
      locationId: stockLocationId,
    });
    if (existing) continue;
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await applyQuantDelta(session, tid, p._id, stockLocationId, '100', '0', new Date(), {
        tracking: 'none',
      });
      await session.commitTransaction();
      seeded += 1;
    } catch {
      try { await session.abortTransaction(); } catch { /* */ }
      try {
        await applyQuantDelta(null, tid, p._id, stockLocationId, '100', '0', new Date(), {
          tracking: 'none',
        });
        seeded += 1;
      } catch { /* */ }
    } finally {
      session.endSession();
    }
  }
  return { seeded, skus: simples.map((p) => p.sku) };
}

const password = arg('password', 'InvAudit2026!');
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/maqder';

await mongoose.connect(uri);
console.log('[fix-audit] connected');

const results = { password, users: [], warehouses: [], openingStock: null, tenantA: null };

for (const email of EMAILS) {
  const user = await User.findOne({ email });
  if (!user) {
    results.users.push({ email, status: 'missing' });
    continue;
  }
  user.password = password;
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.isActive = true;
  if (email === 'admin@inv-audit-a.test') {
    user.role = 'admin';
  }
  await user.save();
  results.users.push({ email, status: 'reset', role: user.role, id: String(user._id) });
}

const tenantA = await Tenant.findOne({ slug: 'inv-audit-a' });
if (tenantA) {
  const tid = tenantA._id;
  const admin = await User.findOne({ tenantId: tid, email: 'admin@inv-audit-a.test' });
  const userId = admin?._id;
  tenantA.subscription = tenantA.subscription || {};
  tenantA.subscription.status = 'active';
  tenantA.subscription.maxUsers = Math.max(Number(tenantA.subscription.maxUsers) || 0, 5);
  tenantA.subscription.features = Array.from(new Set([
    ...(tenantA.subscription.features || []),
    'invoicing', 'inventory', 'multi_warehouse', 'advanced_reports', 'api_access',
  ]));
  tenantA.markModified('subscription');
  await tenantA.save();
  results.tenantA = { id: String(tid), features: tenantA.subscription.features, maxUsers: tenantA.subscription.maxUsers };

  if (userId) {
    results.warehouses.push(await fixWarehousePointers(tid, userId, 'MAIN', 'one', 'ship'));
    results.warehouses.push(await fixWarehousePointers(tid, userId, 'WH2', 'two', 'pickShip'));
    const main = await Warehouse.findOne({ tenantId: tid, code: 'MAIN' });
    results.openingStock = await seedOpeningStock(tid, main?.stockLocationId);
  }
}

console.log(JSON.stringify(results, null, 2));
await mongoose.disconnect();
