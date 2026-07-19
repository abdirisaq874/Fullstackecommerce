/**
 * Multi-store migration — create a default Store per existing seller with
 * `store._id === ownerId (userId)`, so every existing product/order/etc. (whose
 * `sellerId === userId`) already belongs to its store with ZERO data rewrite.
 *
 * Also creates the owner's StoreMembership and backfills globally-unique slugs.
 * Idempotent: safe to re-run. Run AFTER deploying the stores code (so the unique
 * slug index exists) via the backend container, e.g.
 *   node dist/database/migrate-to-stores.js
 */
import 'reflect-metadata';
import mongoose from 'mongoose';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  /* optional */
}

const slugify = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string, {
    dbName: process.env.MONGODB_DB_NAME || 'ecommerce',
  });
  const db = mongoose.connection;
  const users = db.collection('users');
  const settings = db.collection('seller_settings');
  const products = db.collection('products');
  const stores = db.collection('stores');
  const memberships = db.collection('store_memberships');
  const now = new Date();

  // Owner set = seller-role users ∪ existing seller_settings ∪ distinct product sellerIds.
  const ownerIds = new Set<string>();
  for await (const u of users.find({ role: 'seller' }, { projection: { _id: 1 } })) {
    ownerIds.add(u._id.toString());
  }
  for await (const s of settings.find({}, { projection: { sellerId: 1 } })) {
    if (s.sellerId) ownerIds.add(s.sellerId.toString());
  }
  for (const sid of await products.distinct('sellerId')) {
    if (sid) ownerIds.add(sid.toString());
  }

  // Preload existing slugs so re-runs and dedupe don't collide.
  const usedSlugs = new Set<string>();
  for await (const st of stores.find({}, { projection: { slug: 1 } })) {
    if (st.slug) usedSlugs.add(st.slug);
  }

  let created = 0;
  let existing = 0;
  for (const idStr of ownerIds) {
    const _id = new mongoose.Types.ObjectId(idStr);
    const already = await stores.findOne({ _id });
    if (already) {
      existing += 1;
    } else {
      const user = await users.findOne({ _id });
      const setting = await settings.findOne({ sellerId: _id });
      const sp = (setting && setting.storeProfile) || {};
      const displayName =
        sp.displayName ||
        (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '') ||
        'Store';
      let base = slugify(sp.slug || displayName) || `store-${idStr.slice(-6)}`;
      let slug = base;
      let n = 1;
      while (usedSlugs.has(slug)) {
        n += 1;
        slug = `${base}-${n}`;
      }
      usedSlugs.add(slug);
      await stores.insertOne({
        _id,
        ownerId: _id,
        displayName,
        slug,
        logoUrl: sp.logoUrl,
        country: sp.country,
        currency: sp.currency || 'USD',
        supportEmail: sp.supportEmail,
        supportPhone: sp.supportPhone,
        status: 'active',
        payouts: (setting && setting.payouts) || {},
        tax: (setting && setting.tax) || {},
        notifications: (setting && setting.notifications) || {},
        shippingDefaults: (setting && setting.shippingDefaults) || {},
        preferredLanguage: (setting && setting.preferredLanguage) || 'en',
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    }
    // Ensure the owner membership (idempotent).
    await memberships.updateOne(
      { storeId: _id, userId: _id },
      {
        $set: { role: 'owner', status: 'active', acceptedAt: now, updatedAt: now },
        $setOnInsert: { storeId: _id, userId: _id, createdAt: now },
      },
      { upsert: true },
    );
  }

  console.log(`✓ migrate-to-stores: owners=${ownerIds.size} storesCreated=${created} alreadyExisted=${existing}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('migrate-to-stores FAILED:', e);
  process.exit(1);
});
