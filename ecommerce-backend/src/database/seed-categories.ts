/**
 * Seed a localized (en/so) category taxonomy — a trimmed, marketplace-relevant
 * subset of the Google Product Taxonomy — with per-category facetable-attribute
 * config. Idempotent (upsert by slug). Run: `npm run seed:categories`.
 *
 * Connects to MongoDB directly (no Redis/OpenSearch needed) so it runs with
 * just the database up. Reads MONGODB_URI / MONGODB_DB_NAME from .env.
 *
 * Each category carries:
 *  - localizations.{en,so}.name   → drives storefront + facet labels + search
 *  - ancestors[] + path + depth   → fast subtree queries / breadcrumbs
 *  - facets[]                      → which attributes become dynamic filters
 *  - googleTaxonomyId             → maps to Google Shopping for ads later
 */
import 'reflect-metadata';
import mongoose, { Model, Types } from 'mongoose';
import { Category, CategoryFacet, CategorySchema } from '../products/schemas/product.schema';

// Best-effort .env load (dotenv ships with @nestjs/config).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  dotenv.config();
  dotenv.config({ path: '.env.local' });
} catch {
  /* dotenv optional */
}

interface SeedNode {
  slug: string;
  name: { en: string; so: string };
  googleTaxonomyId?: number;
  facets?: CategoryFacet[];
  children?: SeedNode[];
}

// ── Reusable facet definitions (localized labels) ──
const F = {
  color: { attributeKey: 'color', type: 'color', label: { en: 'Color', so: 'Midabka' }, order: 1 } as CategoryFacet,
  size: { attributeKey: 'size', type: 'terms', label: { en: 'Size', so: 'Cabbirka' }, order: 2 } as CategoryFacet,
  material: { attributeKey: 'material', type: 'terms', label: { en: 'Material', so: 'Walxaha' }, order: 3 } as CategoryFacet,
  storage: { attributeKey: 'storage', type: 'range', label: { en: 'Storage', so: 'Kaydka' }, unit: 'GB', order: 2 } as CategoryFacet,
  ram: { attributeKey: 'ram', type: 'terms', label: { en: 'RAM', so: 'RAM' }, order: 3 } as CategoryFacet,
  screen: { attributeKey: 'screen_size', type: 'range', label: { en: 'Screen Size', so: 'Cabbirka Shaashadda' }, unit: 'in', order: 4 } as CategoryFacet,
  skinType: { attributeKey: 'skin_type', type: 'terms', label: { en: 'Skin Type', so: 'Nooca Maqaarka' }, order: 1 } as CategoryFacet,
  ageGroup: { attributeKey: 'age_group', type: 'terms', label: { en: 'Age Group', so: 'Qaybta Da’da' }, order: 1 } as CategoryFacet,
};

const TAXONOMY: SeedNode[] = [
  {
    slug: 'electronics', name: { en: 'Electronics', so: 'Elektaroonig' }, googleTaxonomyId: 222,
    children: [
      { slug: 'mobile-phones', name: { en: 'Mobile Phones', so: 'Taleefannada Gacanta' }, googleTaxonomyId: 267, facets: [F.color, F.storage, F.ram, F.screen] },
      { slug: 'laptops', name: { en: 'Laptops', so: 'Kombuyuutarrada' }, googleTaxonomyId: 328, facets: [F.color, F.ram, F.storage, F.screen] },
      { slug: 'headphones', name: { en: 'Headphones', so: 'Dhegeysiyada' }, facets: [F.color] },
    ],
  },
  {
    slug: 'apparel', name: { en: 'Apparel & Accessories', so: 'Dharka & Qalabka' }, googleTaxonomyId: 166,
    children: [
      { slug: 'mens-clothing', name: { en: "Men's Clothing", so: 'Dharka Ragga' }, facets: [F.size, F.color, F.material] },
      { slug: 'womens-clothing', name: { en: "Women's Clothing", so: 'Dharka Dumarka' }, facets: [F.size, F.color, F.material] },
      { slug: 'shoes', name: { en: 'Shoes', so: 'Kabaha' }, googleTaxonomyId: 187, facets: [F.size, F.color, F.material] },
    ],
  },
  {
    slug: 'home-garden', name: { en: 'Home & Garden', so: 'Guriga & Beerta' }, googleTaxonomyId: 536,
    children: [
      { slug: 'furniture', name: { en: 'Furniture', so: 'Alaabta Guriga' }, facets: [F.material, F.color] },
      { slug: 'kitchen', name: { en: 'Kitchen & Dining', so: 'Jikada & Cuntada' }, facets: [F.material, F.color] },
    ],
  },
  {
    slug: 'health-beauty', name: { en: 'Health & Beauty', so: 'Caafimaad & Quruxda' }, googleTaxonomyId: 469,
    children: [
      { slug: 'skincare', name: { en: 'Skincare', so: 'Daryeelka Maqaarka' }, facets: [F.skinType] },
      { slug: 'fragrances', name: { en: 'Fragrances', so: 'Cadarrada' }, facets: [] },
    ],
  },
  {
    slug: 'baby-kids', name: { en: 'Baby & Kids', so: 'Carruurta & Dhallaanka' }, googleTaxonomyId: 537,
    children: [
      { slug: 'toys', name: { en: 'Toys', so: 'Cayaaraha' }, facets: [F.ageGroup, F.color] },
    ],
  },
  { slug: 'groceries', name: { en: 'Groceries', so: 'Raashinka' }, googleTaxonomyId: 412 },
  { slug: 'sporting-goods', name: { en: 'Sporting Goods', so: 'Alaabta Isboortiga' }, googleTaxonomyId: 499 },
];

async function upsertNode(
  model: Model<Category>,
  node: SeedNode,
  parent: { id: Types.ObjectId; path: string; ancestors: Types.ObjectId[] } | null,
  sortOrder: number,
): Promise<void> {
  const depth = parent ? parent.ancestors.length + 1 : 0;
  const path = parent ? `${parent.path}.${node.slug}` : node.slug;
  const ancestors = parent ? [...parent.ancestors, parent.id] : [];

  const doc = await model.findOneAndUpdate(
    { slug: node.slug },
    {
      $set: {
        name: node.name.en,
        parentId: parent?.id,
        ancestors,
        depth,
        path,
        sortOrder,
        isActive: true,
        googleTaxonomyId: node.googleTaxonomyId,
        facets: node.facets || [],
        localizations: {
          en: { name: node.name.en },
          so: { name: node.name.so },
        },
      },
    },
    { upsert: true, new: true },
  );

  if (node.children?.length) {
    let i = 0;
    for (const child of node.children) {
      await upsertNode(model, child, { id: doc._id, path, ancestors }, i++);
    }
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
  const dbName = process.env.MONGODB_DB_NAME || 'ecommerce';

  console.log(`Connecting to MongoDB (${dbName})…`);
  await mongoose.connect(uri, { dbName });
  const model = mongoose.model<Category>(Category.name, CategorySchema);

  let i = 0;
  for (const node of TAXONOMY) {
    await upsertNode(model, node, null, i++);
  }

  const total = await model.countDocuments();
  console.log(`✅ Category taxonomy seeded. Total categories: ${total}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Category seed failed:', err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
