/**
 * Unlock + reset inventory audit seed passwords to match current login
 * (bcrypt of plaintext — frontend sends obfuscated plaintext, not SHA-256).
 *
 * Usage (inside backend container):
 *   node scripts/fixInventoryAuditPasswords.js
 *   node scripts/fixInventoryAuditPasswords.js --password='YourPass!'
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';

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

const password = arg('password', 'InvAudit2026!');
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/maqder';

await mongoose.connect(uri);
console.log('[fix-audit-pw] connected');

const results = [];
for (const email of EMAILS) {
  const user = await User.findOne({ email });
  if (!user) {
    results.push({ email, status: 'missing' });
    continue;
  }
  user.password = password;
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.isActive = true;
  await user.save();
  results.push({ email, status: 'reset', id: String(user._id), role: user.role });
}

console.log(JSON.stringify({ password, results }, null, 2));
await mongoose.disconnect();
