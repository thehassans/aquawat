/**
 * Unlock a user locked by failed login attempts.
 *
 * Usage (from backend/ with MONGO_URI set):
 *   node scripts/unlockUser.js user@example.com
 *   node scripts/unlockUser.js --all
 */
import mongoose from 'mongoose';
import User from '../models/User.js';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/unlockUser.js <email> | --all');
  process.exit(1);
}

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!uri) {
  console.error('Set MONGO_URI (or MONGODB_URI / DATABASE_URL) before running.');
  process.exit(1);
}

await mongoose.connect(uri);

const filter = arg === '--all'
  ? { $or: [{ lockUntil: { $exists: true } }, { loginAttempts: { $gt: 0 } }] }
  : { email: String(arg).trim().toLowerCase() };

const result = await User.updateMany(filter, {
  $set: { loginAttempts: 0 },
  $unset: { lockUntil: 1 },
});

console.log(`Unlocked ${result.modifiedCount} user(s).`);
await mongoose.disconnect();
