import { Injectable, Logger } from '@nestjs/common';
import { ProductService } from '../products/product.service';

// Public storefront base — product `link`s in the feed must point at pages a
// shopper (and Meta's crawler) can actually open. FRONTEND_URL is a
// comma-separated allow-list (storefront,seller-portal) shared with CORS, so we
// take the first entry (the storefront) and drop any trailing slash.
const STOREFRONT_URL = (process.env.FRONTEND_URL || 'https://shop.gaarsiiglobal.com')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '');

// Dev/CI image placeholder the uploads service falls back to when R2 is unset.
// Meta rejects items whose image_link 404s, so we drop these.
const PLACEHOLDER_IMAGE_HOST = 'https://cdn.example.com';

/**
 * Generates the Meta Commerce / Google Merchant product feed (RSS 2.0 with the
 * `g:` namespace). Meta Commerce Manager pulls this URL on a schedule, keeping
 * the catalog in sync with live product data (price, stock, new products) with
 * no manual re-uploads. The same feed format works for Google Merchant Center.
 */
@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(private readonly productService: ProductService) {}

  async generateFacebookFeed(): Promise<string> {
    // Preload brand/category lookups once (2 queries) so per-product resolution
    // is O(1) — avoids an N+1 populate over the whole catalog.
    const [brandMap, categoryMap] = await Promise.all([
      this.productService.getFeedBrandMap(),
      this.productService.getFeedCategoryMap(),
    ]);

    const cursor = this.productService.findActiveForFeedCursor();

    const items: string[] = [];
    let skipped = 0;

    for await (const product of cursor) {
      const item = this.buildItem(product as Record<string, any>, brandMap, categoryMap);
      if (item) items.push(item);
      else skipped++;
    }

    this.logger.log(
      `Facebook feed generated: ${items.length} products, ${skipped} skipped`,
    );

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
      '<channel>',
      '<title>Suuq — Product Feed</title>',
      `<link>${this.escape(STOREFRONT_URL)}</link>`,
      '<description>Product catalog for Meta Commerce</description>',
      `<!-- ${items.length} items, ${skipped} skipped -->`,
      ...items,
      '</channel>',
      '</rss>',
    ].join('\n');
  }

  /**
   * Map one product to a feed <item>, or null if it lacks a field Meta
   * requires (a usable image, or a positive price) — better to omit an item
   * than ship one Meta will reject.
   */
  private buildItem(
    p: Record<string, any>,
    brandMap: Map<string, string>,
    categoryMap: Map<string, { name: string; googleTaxonomyId?: number }>,
  ): string | null {
    const slug: string = p.slug;
    const name: string = p.name;
    if (!slug || !name) return null;

    // Real, non-placeholder images only. Meta requires image_link.
    const images: any[] = (p.images || []).filter(
      (img: any) => img?.url && !String(img.url).startsWith(PLACEHOLDER_IMAGE_HOST),
    );
    if (!images.length) return null;

    const price: number = typeof p.basePrice === 'number' ? p.basePrice : 0;
    if (!(price > 0)) return null; // Meta rejects zero/invalid price

    // Primary image: explicit flag → lowest sortOrder → first.
    const primary =
      images.find((i) => i.isPrimary) ||
      [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0];
    const additional = images.filter((i) => i !== primary).slice(0, 20);

    const currency: string = p.currency || 'USD';
    // compareAtPrice is the "was"/list price; basePrice is the current price.
    // Meta wants price=regular, sale_price=discounted.
    const compareAt =
      typeof p.compareAtPrice === 'number' ? p.compareAtPrice : undefined;
    const hasSale = compareAt !== undefined && compareAt > price;

    const description =
      this.clean(p.description) || this.clean(p.shortDescription) || name;

    const brand = p.brandId ? brandMap.get(String(p.brandId)) : undefined;
    const category = p.categoryId ? categoryMap.get(String(p.categoryId)) : undefined;
    const googleCategory = category?.googleTaxonomyId;
    const productType = category?.name;

    const lines: string[] = ['<item>'];
    lines.push(this.tag('g:id', slug));
    lines.push(this.tag('g:title', this.truncate(name, 150)));
    lines.push(this.tag('g:description', this.truncate(description, 5000)));
    lines.push(this.tag('g:link', `${STOREFRONT_URL}/product/${slug}`));
    lines.push(this.tag('g:image_link', primary.url));
    for (const img of additional) {
      lines.push(this.tag('g:additional_image_link', img.url));
    }
    lines.push(this.tag('g:availability', p.stock > 0 ? 'in stock' : 'out of stock'));
    lines.push(this.tag('g:condition', ['new', 'used', 'refurbished'].includes(p.condition) ? p.condition : 'new'));
    if (hasSale) {
      lines.push(this.tag('g:price', `${compareAt!.toFixed(2)} ${currency}`));
      lines.push(this.tag('g:sale_price', `${price.toFixed(2)} ${currency}`));
    } else {
      lines.push(this.tag('g:price', `${price.toFixed(2)} ${currency}`));
    }
    if (brand) lines.push(this.tag('g:brand', this.truncate(brand, 100)));
    if (googleCategory) {
      lines.push(this.tag('g:google_product_category', String(googleCategory)));
    }
    if (productType) {
      lines.push(this.tag('g:product_type', this.truncate(productType, 750)));
    }
    // Structured attributes (auto-derived by normalization) → improve Meta/Google
    // ad eligibility + delivery for apparel/footwear. Map to the feed's vocabularies.
    const attr = (k: string) =>
      (p.attributes || []).find((a: any) => String(a.key).toLowerCase() === k)?.value;
    const genderMap: Record<string, string> = { men: 'male', women: 'female', unisex: 'unisex', kids: 'unisex' };
    const gAttr = attr('gender');
    if (gAttr && genderMap[gAttr]) lines.push(this.tag('g:gender', genderMap[gAttr]));
    const ageGroup = attr('age_group') || (gAttr === 'kids' ? 'kids' : undefined);
    if (ageGroup && ['newborn', 'infant', 'toddler', 'kids', 'adult'].includes(ageGroup)) {
      lines.push(this.tag('g:age_group', ageGroup));
    }
    const color = attr('color');
    if (color) lines.push(this.tag('g:color', this.truncate(color, 100)));
    const material = attr('material');
    if (material) lines.push(this.tag('g:material', this.truncate(material, 200)));
    const dims = p.packageDimensionsCm;
    if (dims?.length) lines.push(this.tag('g:shipping_length', `${dims.length} cm`));
    if (dims?.width) lines.push(this.tag('g:shipping_width', `${dims.width} cm`));
    if (dims?.height) lines.push(this.tag('g:shipping_height', `${dims.height} cm`));
    // GTIN from a variant barcode (only if it looks like a real UPC/EAN/GTIN).
    const gtin = (p.variants || []).find((v: any) => v?.barcode)?.barcode || p.gtin || attr('gtin');
    if (gtin && /^\d{8,14}$/.test(String(gtin).trim())) {
      lines.push(this.tag('g:gtin', String(gtin).trim()));
    }
    lines.push('</item>');
    return lines.join('');
  }

  private tag(name: string, value: string): string {
    return `<${name}>${this.escape(value)}</${name}>`;
  }

  /** Strip HTML tags and collapse whitespace (descriptions may carry markup). */
  private clean(text?: string): string {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
  }

  private escape(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // Strip XML-illegal control characters.
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }
}
