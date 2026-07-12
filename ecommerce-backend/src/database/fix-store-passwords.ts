/**
 * One-off: set passwordHash for the script-created store accounts (the import/
 * backfill originally wrote to a non-existent `password` field, so these users
 * had no passwordHash and couldn't log in). Uses updateOne ($set, no pre-save
 * hook) with a pre-computed bcrypt hash — so no double-hashing.
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserSchema } from '../users/schemas/user.schema';

try { require('dotenv').config(); } catch { /* optional */ }

const EMAILS = ['ilyas@suuq.store', 'volt.electronics@suuq.store', 'casa.living@suuq.store', 'peak.play@suuq.store'];
const PASSWORD = 'StorePass1!';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string, { dbName: process.env.MONGODB_DB_NAME || 'ecommerce' });
  const User = mongoose.model('User', UserSchema);
  const hash = await bcrypt.hash(PASSWORD, 12);
  let fixed = 0;
  for (const email of EMAILS) {
    const res = await User.updateOne({ email }, { $set: { passwordHash: hash, role: 'seller', isActive: true, emailVerified: true }, $unset: { password: '' } });
    if (res.matchedCount) fixed += 1;
    console.log(`  ${email}: ${res.matchedCount ? 'fixed' : 'NOT FOUND'}`);
  }
  console.log(`\n✅ Set passwordHash on ${fixed}/${EMAILS.length} store accounts (password: ${PASSWORD}).`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error('Fix failed:', e); process.exit(1); });
