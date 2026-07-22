import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { ProductService } from '../products/product.service';

// Turn an array into the async-iterable a Mongoose `.cursor()` exposes, so we
// can drive FeedService without a database.
function asCursor(items: any[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

describe('FeedService', () => {
  let service: FeedService;
  const findActiveForFeedCursor = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: ProductService, useValue: { findActiveForFeedCursor } },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
    jest.clearAllMocks();
  });

  const fullProduct = {
    slug: 'red-shoes',
    name: 'Red Shoes',
    description: 'Comfortable <b>red</b> running shoes',
    basePrice: 49.9,
    currency: 'USD',
    stock: 5,
    images: [
      { url: 'https://cdn.r2.dev/product/a/1.jpg', isPrimary: true, sortOrder: 0 },
      { url: 'https://cdn.r2.dev/product/a/2.jpg', sortOrder: 1 },
    ],
    brandId: { name: 'Nike' },
    categoryId: { name: 'Shoes', googleTaxonomyId: 187 },
  };

  it('emits a valid RSS feed with the g: namespace', async () => {
    findActiveForFeedCursor.mockReturnValue(asCursor([fullProduct]));

    const xml = await service.generateFacebookFeed();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain('<g:id>red-shoes</g:id>');
    expect(xml).toContain('<g:title>Red Shoes</g:title>');
    expect(xml).toContain(
      '<g:link>https://shop.gaarsiiglobal.com/product/red-shoes</g:link>',
    );
    expect(xml).toContain('<g:image_link>https://cdn.r2.dev/product/a/1.jpg</g:image_link>');
    expect(xml).toContain(
      '<g:additional_image_link>https://cdn.r2.dev/product/a/2.jpg</g:additional_image_link>',
    );
    expect(xml).toContain('<g:availability>in stock</g:availability>');
    expect(xml).toContain('<g:condition>new</g:condition>');
    expect(xml).toContain('<g:price>49.90 USD</g:price>');
    expect(xml).toContain('<g:brand>Nike</g:brand>');
    expect(xml).toContain('<g:google_product_category>187</g:google_product_category>');
    expect(xml).toContain('<g:product_type>Shoes</g:product_type>');
  });

  it('strips HTML from the description', async () => {
    findActiveForFeedCursor.mockReturnValue(asCursor([fullProduct]));
    const xml = await service.generateFacebookFeed();
    expect(xml).toContain('<g:description>Comfortable red running shoes</g:description>');
    expect(xml).not.toContain('<b>');
  });

  it('maps compareAtPrice to price and basePrice to sale_price', async () => {
    findActiveForFeedCursor.mockReturnValue(
      asCursor([{ ...fullProduct, basePrice: 30, compareAtPrice: 50 }]),
    );
    const xml = await service.generateFacebookFeed();
    expect(xml).toContain('<g:price>50.00 USD</g:price>');
    expect(xml).toContain('<g:sale_price>30.00 USD</g:sale_price>');
  });

  it('reports out of stock when stock is 0', async () => {
    findActiveForFeedCursor.mockReturnValue(asCursor([{ ...fullProduct, stock: 0 }]));
    const xml = await service.generateFacebookFeed();
    expect(xml).toContain('<g:availability>out of stock</g:availability>');
  });

  it('escapes XML-special characters in text fields', async () => {
    findActiveForFeedCursor.mockReturnValue(
      asCursor([{ ...fullProduct, name: 'Shoes & "Socks" <deal>' }]),
    );
    const xml = await service.generateFacebookFeed();
    expect(xml).toContain('<g:title>Shoes &amp; &quot;Socks&quot; &lt;deal&gt;</g:title>');
  });

  it('skips products with no usable image', async () => {
    findActiveForFeedCursor.mockReturnValue(
      asCursor([
        { ...fullProduct, images: [] },
        { ...fullProduct, images: [{ url: 'https://cdn.example.com/product/x/1.jpg' }] },
      ]),
    );
    const xml = await service.generateFacebookFeed();
    expect(xml).not.toContain('<item>');
    expect(xml).toContain('<!-- 0 items, 2 skipped -->');
  });

  it('skips products with a zero/invalid price', async () => {
    findActiveForFeedCursor.mockReturnValue(asCursor([{ ...fullProduct, basePrice: 0 }]));
    const xml = await service.generateFacebookFeed();
    expect(xml).not.toContain('<item>');
  });

  it('omits optional tags (brand/category) when absent', async () => {
    findActiveForFeedCursor.mockReturnValue(
      asCursor([{ ...fullProduct, brandId: null, categoryId: null }]),
    );
    const xml = await service.generateFacebookFeed();
    expect(xml).toContain('<item>');
    expect(xml).not.toContain('<g:brand>');
    expect(xml).not.toContain('<g:google_product_category>');
    expect(xml).not.toContain('<g:product_type>');
  });
});
