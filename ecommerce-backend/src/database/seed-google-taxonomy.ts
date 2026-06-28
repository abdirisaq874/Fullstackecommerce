/**
 * Seed the FULL Google Product Taxonomy (~5,595 categories) into MongoDB.
 *
 * Downloads Google's official `taxonomy-with-ids.en-US.txt`, builds the complete
 * parent/ancestors/path/depth hierarchy, and REPLACES the categories collection.
 * English-only for now (localizations.en.name); googleTaxonomyId is the line ID.
 *
 * Run: `npx ts-node src/database/seed-google-taxonomy.ts`
 * Reads MONGODB_URI / MONGODB_DB_NAME from env. No Redis/OpenSearch needed.
 */
import 'reflect-metadata';
import mongoose, { Types } from 'mongoose';
import { CategorySchema } from '../products/schemas/product.schema';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  dotenv.config();
  dotenv.config({ path: '.env.local' });
} catch {
  /* dotenv optional */
}

const TAXONOMY_URL =
  process.env.GOOGLE_TAXONOMY_URL ||
  'https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
  const dbName = process.env.MONGODB_DB_NAME || 'ecommerce';

  console.log(`Fetching Google taxonomy: ${TAXONOMY_URL}`);
  const fetchFn: any = (globalThis as any).fetch;
  const res: any = await fetchFn(TAXONOMY_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const text: string = await res.text();
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  console.log(`Parsed ${lines.length} taxonomy lines.`);

  // Parse "<id> - Level1 > Level2 > Leaf"
  interface Node {
    googleId: number;
    parts: string[];
  }
  const nodes: Node[] = [];
  for (const line of lines) {
    const dash = line.indexOf(' - ');
    if (dash < 0) continue;
    const googleId = parseInt(line.slice(0, dash), 10);
    const parts = line
      .slice(dash + 3)
      .split('>')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!googleId || !parts.length) continue;
    nodes.push({ googleId, parts });
  }
  // Parents before children
  nodes.sort((a, b) => a.parts.length - b.parts.length);

  const byPath = new Map<
    string,
    { _id: Types.ObjectId; ancestors: Types.ObjectId[]; path: string }
  >();
  const usedSlugs = new Set<string>();
  const docs: any[] = [];

  for (const n of nodes) {
    const name = n.parts[n.parts.length - 1];
    let slug = slugify(name) || `cat-${n.googleId}`;
    if (usedSlugs.has(slug)) slug = `${slug}-${n.googleId}`;
    usedSlugs.add(slug);

    const _id = new Types.ObjectId();
    const parentParts = n.parts.slice(0, -1);
    const parent = parentParts.length ? byPath.get(parentParts.join(' > ')) : undefined;
    const ancestors = parent ? [...parent.ancestors, parent._id] : [];
    const path = parent ? `${parent.path}.${slug}` : slug;

    byPath.set(n.parts.join(' > '), { _id, ancestors, path });
    docs.push({
      _id,
      name,
      slug,
      depth: n.parts.length - 1,
      path,
      parentId: parent ? parent._id : undefined,
      ancestors,
      googleTaxonomyId: n.googleId,
      localizations: { en: { name } },
      isActive: true,
    });
  }

  console.log(`Built ${docs.length} category docs. Connecting to "${dbName}"…`);
  await mongoose.connect(uri, { dbName });
  const Category = mongoose.model('Category', CategorySchema);

  console.log('Clearing existing categories…');
  await Category.deleteMany({});
  console.log('Inserting full Google taxonomy…');
  await Category.insertMany(docs, { ordered: false });

  const total = await Category.countDocuments();
  const roots = await Category.countDocuments({ depth: 0 });
  const maxDepthDoc = await Category.findOne().sort({ depth: -1 }).select('depth').lean();
  console.log(
    `✅ Done. ${total} categories in "${dbName}" (${roots} top-level, max depth ${maxDepthDoc?.depth}).`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
