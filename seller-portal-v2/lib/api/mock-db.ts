import type {
  Product, Order, InventoryRow, Return, MessageThread, Customer,
  ShippingZone, Promotion, Transaction, DashboardMetrics, Notification,
  ProductLeaderboardEntry,
} from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Reference data
// ────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { id: 'cat-apparel',     name: 'Apparel & clothing'   },
  { id: 'cat-textiles',    name: 'Textiles & home'      },
  { id: 'cat-accessories', name: 'Accessories'          },
  { id: 'cat-footwear',    name: 'Footwear'             },
  { id: 'cat-bags',        name: 'Bags & leather goods' },
  { id: 'cat-jewelry',     name: 'Jewelry & watches'    },
];

export const BRANDS = [
  { id: 'brand-aysel',    name: 'Aysel Tekstil'  },
  { id: 'brand-bursa',    name: 'Bursa Atelier'  },
  { id: 'brand-anatolia', name: 'Anatolia Co.'   },
  { id: 'brand-house',    name: 'House label'    },
];

export const CURRENCIES = ['USD', 'TRY', 'KES', 'ETB', 'EUR'];

export const LOCALES = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe',   flag: '🇹🇷' },
  { code: 'so', label: 'Soomaali', flag: '🇸🇴' },
  { code: 'sw', label: 'Kiswahili',flag: '🇰🇪' },
  { code: 'am', label: 'አማርኛ',     flag: '🇪🇹' },
] as const;

// ────────────────────────────────────────────────────────────
// Mutable seed data (lives in a module variable — RTK reads/writes here)
// ────────────────────────────────────────────────────────────

export const db = {
  products: [
    {
      id: 'p1', name: 'Cotton kaftan, navy', sku: 'KAFT-NV-M', initial: 'K',
      basePrice: 48, compareAtPrice: 65, currency: 'USD', stock: 34,
      status: 'active', isFeatured: true,
      categoryId: 'cat-apparel', brandId: 'brand-aysel',
      shortDescription: 'Lightweight, breathable kaftan in deep navy with subtle gold trim.',
      description: 'Hand-tailored from 100% premium Turkish cotton. Each piece is finished in Bursa by skilled artisans, combining traditional craftsmanship with modern comfort.',
      metaTitle: 'Cotton Kaftan, Navy — Gaarsii',
      metaDescription: 'Hand-tailored from premium Turkish cotton. Free shipping to East Africa.',
      attributes: [
        { key: 'Material', value: '100% Turkish cotton' },
        { key: 'Origin',   value: 'Bursa, Türkiye'      },
        { key: 'Care',     value: 'Machine wash cold'   },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400', altText: 'Front view', isPrimary: true, sortOrder: 0 },
        { url: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=400', altText: 'Detail', sortOrder: 1 },
      ],
      variants: [
        { sku: 'KAFT-NV-S', name: 'Navy / Small',  options: [{ name: 'Size', value: 'S' }, { name: 'Color', value: 'Navy' }], stockOnHand: 8,  priceOverride: '', costPrice: 18, weightGrams: 280 },
        { sku: 'KAFT-NV-M', name: 'Navy / Medium', options: [{ name: 'Size', value: 'M' }, { name: 'Color', value: 'Navy' }], stockOnHand: 14, priceOverride: '', costPrice: 18, weightGrams: 300 },
        { sku: 'KAFT-NV-L', name: 'Navy / Large',  options: [{ name: 'Size', value: 'L' }, { name: 'Color', value: 'Navy' }], stockOnHand: 12, priceOverride: '', costPrice: 18, weightGrams: 320 },
      ],
      localizations: {
        en: { name: 'Cotton kaftan, navy', shortDescription: 'Lightweight, breathable kaftan in deep navy.' },
        tr: { name: 'Pamuklu kaftan, lacivert', shortDescription: 'Lacivert renkte hafif, nefes alabilen pamuk kaftan.' },
        so: { name: 'Diric pamuko ah, buluug', shortDescription: '' },
      },
      totalSold: 47, revenueLifetime: 2256, viewsLifetime: 1240, conversionRate: 3.8, returnRate: 2.1,
      updatedAt: '2 hours ago', createdAt: '12 days ago',
    },
    {
      id: 'p2', name: 'Linen blazer, beige', sku: 'BLZR-BG-L', initial: 'L',
      basePrice: 112, compareAtPrice: null, currency: 'USD', stock: 12,
      status: 'active', isFeatured: false,
      categoryId: 'cat-apparel', brandId: 'brand-bursa',
      shortDescription: 'Tailored linen blazer with mother-of-pearl buttons.',
      description: 'A versatile warm-weather blazer in lightweight Belgian linen, hand-finished in Istanbul.',
      metaTitle: '', metaDescription: '',
      attributes: [
        { key: 'Material', value: 'Belgian linen' },
        { key: 'Origin',   value: 'Istanbul, Türkiye' },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400', altText: '', isPrimary: true, sortOrder: 0 }],
      variants: [],
      localizations: { en: { name: 'Linen blazer, beige' } },
      totalSold: 18, revenueLifetime: 2016, viewsLifetime: 624, conversionRate: 2.9, returnRate: 5.6,
      updatedAt: '1 day ago', createdAt: '1 month ago',
    },
    {
      id: 'p3', name: 'Silk scarf, floral', sku: 'SCRF-FL-001', initial: 'S',
      basePrice: 24, compareAtPrice: null, currency: 'USD', stock: 4,
      status: 'active', isFeatured: false,
      categoryId: 'cat-accessories', brandId: 'brand-anatolia',
      shortDescription: 'Hand-printed silk scarf with floral motif.',
      description: '', metaTitle: '', metaDescription: '',
      attributes: [{ key: 'Material', value: '100% silk' }],
      images: [{ url: 'https://images.unsplash.com/photo-1601244005535-a48d21d951ac?w=400', altText: '', isPrimary: true, sortOrder: 0 }],
      variants: [],
      localizations: { en: { name: 'Silk scarf, floral' } },
      totalSold: 32, revenueLifetime: 768, viewsLifetime: 894, conversionRate: 3.6, returnRate: 1.2,
      updatedAt: '3 hours ago', createdAt: '2 weeks ago',
    },
    {
      id: 'p4', name: 'Leather sandals, tan', sku: 'SAND-LT-42', initial: 'L',
      basePrice: 76, compareAtPrice: 92, currency: 'USD', stock: 0,
      status: 'active', isFeatured: false,
      categoryId: 'cat-footwear', brandId: 'brand-anatolia',
      shortDescription: 'Hand-stitched tan leather sandals.',
      description: '', metaTitle: '', metaDescription: '',
      attributes: [], images: [], variants: [],
      localizations: { en: { name: 'Leather sandals, tan' } },
      totalSold: 12, revenueLifetime: 912, viewsLifetime: 412, conversionRate: 2.9, returnRate: 8.3,
      updatedAt: '5 days ago', createdAt: '2 months ago',
    },
    {
      id: 'p5', name: 'Wool sweater, charcoal', sku: 'SWTR-CH-M', initial: 'W',
      basePrice: 89, compareAtPrice: null, currency: 'USD', stock: null,
      status: 'draft', isFeatured: false,
      categoryId: 'cat-apparel', brandId: 'brand-house',
      shortDescription: '', description: '', metaTitle: '', metaDescription: '',
      attributes: [], images: [], variants: [],
      localizations: { en: { name: 'Wool sweater, charcoal' } },
      totalSold: 0, revenueLifetime: 0, viewsLifetime: 0, conversionRate: 0, returnRate: 0,
      updatedAt: '6 days ago', createdAt: '6 days ago',
    },
    {
      id: 'p6', name: 'Embroidered tunic, ivory', sku: 'TUNC-IV-S', initial: 'T',
      basePrice: 64, compareAtPrice: null, currency: 'USD', stock: 22,
      status: 'active', isFeatured: false,
      categoryId: 'cat-apparel', brandId: 'brand-aysel',
      shortDescription: 'Hand-embroidered ivory tunic with traditional motifs.',
      description: '', metaTitle: '', metaDescription: '',
      attributes: [], images: [], variants: [],
      localizations: { en: { name: 'Embroidered tunic, ivory' } },
      totalSold: 24, revenueLifetime: 1536, viewsLifetime: 720, conversionRate: 3.3, returnRate: 1.8,
      updatedAt: 'Yesterday', createdAt: '3 weeks ago',
    },
    {
      id: 'p7', name: 'Hand-loom wrap, terracotta', sku: 'WRAP-TR-OS', initial: 'W',
      basePrice: 38, compareAtPrice: null, currency: 'USD', stock: 9,
      status: 'active', isFeatured: false,
      categoryId: 'cat-textiles', brandId: 'brand-house',
      shortDescription: '', description: '', metaTitle: '', metaDescription: '',
      attributes: [], images: [], variants: [],
      localizations: { en: { name: 'Hand-loom wrap, terracotta' } },
      totalSold: 8, revenueLifetime: 304, viewsLifetime: 220, conversionRate: 3.6, returnRate: 2.5,
      updatedAt: '4 days ago', createdAt: '5 weeks ago',
    },
  ] as Product[],

  orders: [
    {
      id: 'GG-10847', customer: 'Amina Hassan', customerEmail: 'amina.h@example.com', customerPhone: '+252 61 1234567',
      destination: 'Mogadishu, SO', destinationFull: 'Hodan District, Mogadishu, Somalia',
      total: 184.20, subtotal: 162.20, shipping: 18.00, tax: 4.00,
      items: 3, status: 'processing', date: 'Today, 14:22', placedAt: '2026-05-10T14:22',
      paymentMethod: 'Stripe · Visa ...4242', carrier: 'DHL Express', trackingNumber: '',
      itemsList: [
        { productId: 'p1', name: 'Cotton kaftan, navy', sku: 'KAFT-NV-M', quantity: 1, price: 48,    initial: 'K' },
        { productId: 'p3', name: 'Silk scarf, floral',  sku: 'SCRF-FL-001', quantity: 2, price: 24,  initial: 'S' },
        { productId: 'p6', name: 'Embroidered tunic',   sku: 'TUNC-IV-S', quantity: 1, price: 66.20, initial: 'T' },
      ],
      timeline: [
        { event: 'Order placed', date: 'Today, 14:22' },
        { event: 'Payment confirmed via Stripe', date: 'Today, 14:23' },
        { event: 'Status changed to Processing', date: 'Today, 14:30' },
      ],
    },
    {
      id: 'GG-10846', customer: 'James Mwangi', customerEmail: 'j.mwangi@example.com', customerPhone: '+254 712 345678',
      destination: 'Nairobi, KE', destinationFull: 'Kilimani, Nairobi, Kenya',
      total: 67.00, subtotal: 55.00, shipping: 12.00, tax: 0,
      items: 1, status: 'confirmed', date: 'Today, 11:08', placedAt: '2026-05-10T11:08',
      paymentMethod: 'Flutterwave · M-Pesa', carrier: 'Aramex', trackingNumber: '',
      itemsList: [{ productId: 'p3', name: 'Silk scarf, floral', sku: 'SCRF-FL-001', quantity: 2, price: 27.50, initial: 'S' }],
      timeline: [
        { event: 'Order placed', date: 'Today, 11:08' },
        { event: 'Payment confirmed via Flutterwave', date: 'Today, 11:09' },
      ],
    },
    {
      id: 'GG-10845', customer: 'Selam Tadesse', customerEmail: 'selam.t@example.com', customerPhone: '+251 911 234567',
      destination: 'Addis Ababa, ET', destinationFull: 'Bole, Addis Ababa, Ethiopia',
      total: 245.50, subtotal: 230.50, shipping: 15.00, tax: 0,
      items: 4, status: 'shipped', date: 'Yesterday', placedAt: '2026-05-09T09:14',
      paymentMethod: 'Stripe · Visa ...1881', carrier: 'DHL Express', trackingNumber: 'JD012345678',
      itemsList: [
        { productId: 'p2', name: 'Linen blazer, beige', sku: 'BLZR-BG-L', quantity: 1, price: 112,  initial: 'L' },
        { productId: 'p1', name: 'Cotton kaftan, navy', sku: 'KAFT-NV-M', quantity: 2, price: 48,   initial: 'K' },
        { productId: 'p7', name: 'Hand-loom wrap',      sku: 'WRAP-TR-OS', quantity: 1, price: 38, initial: 'W' },
      ],
      timeline: [
        { event: 'Order placed', date: 'Yesterday, 09:14' },
        { event: 'Payment confirmed', date: 'Yesterday, 09:15' },
        { event: 'Marked as processing', date: 'Yesterday, 11:30' },
        { event: 'Shipped via DHL · JD012345678', date: 'Yesterday, 16:42' },
      ],
    },
    {
      id: 'GG-10844', customer: 'Faisal Omar', customerEmail: 'f.omar@example.com', customerPhone: '+252 90 9876543',
      destination: 'Hargeisa, SO', destinationFull: '26 June District, Hargeisa, Somaliland',
      total: 92.40, subtotal: 74.40, shipping: 18.00, tax: 0,
      items: 2, status: 'shipped', date: '2 days ago', placedAt: '2026-05-08T15:30',
      paymentMethod: 'Stripe · Mastercard ...3401', carrier: 'DHL Express', trackingNumber: 'JD012345677',
      itemsList: [
        { productId: 'p3', name: 'Silk scarf, floral', sku: 'SCRF-FL-001', quantity: 1, price: 24, initial: 'S' },
        { productId: 'p7', name: 'Hand-loom wrap',     sku: 'WRAP-TR-OS', quantity: 1, price: 50.40, initial: 'W' },
      ],
      timeline: [],
    },
    {
      id: 'GG-10843', customer: 'Joyce Wanjiru', customerEmail: 'j.wanjiru@example.com', customerPhone: '+254 720 111222',
      destination: 'Nairobi, KE', destinationFull: 'Westlands, Nairobi, Kenya',
      total: 310.00, subtotal: 298.00, shipping: 12.00, tax: 0,
      items: 5, status: 'delivered', date: '3 days ago', placedAt: '2026-05-07T10:00',
      paymentMethod: 'Stripe · Visa ...8920', carrier: 'Aramex', trackingNumber: 'AR98213',
      itemsList: [
        { productId: 'p2', name: 'Linen blazer, beige', sku: 'BLZR-BG-L', quantity: 1, price: 112, initial: 'L' },
        { productId: 'p1', name: 'Cotton kaftan, navy', sku: 'KAFT-NV-M', quantity: 3, price: 48,  initial: 'K' },
        { productId: 'p3', name: 'Silk scarf, floral',  sku: 'SCRF-FL-001', quantity: 1, price: 42, initial: 'S' },
      ],
      timeline: [],
    },
    {
      id: 'GG-10842', customer: 'Mohamed Ali', customerEmail: 'm.ali@example.com', customerPhone: '+252 61 7654321',
      destination: 'Mogadishu, SO', destinationFull: 'Wadajir District, Mogadishu, Somalia',
      total: 128.75, subtotal: 110.75, shipping: 18.00, tax: 0,
      items: 2, status: 'delivered', date: '4 days ago', placedAt: '2026-05-06T13:42',
      paymentMethod: 'Flutterwave · EVC Plus', carrier: 'DHL Express', trackingNumber: 'JD012345670',
      itemsList: [
        { productId: 'p1', name: 'Cotton kaftan, navy', sku: 'KAFT-NV-M', quantity: 1, price: 48, initial: 'K' },
        { productId: 'p6', name: 'Embroidered tunic',   sku: 'TUNC-IV-S', quantity: 1, price: 62.75, initial: 'T' },
      ],
      timeline: [],
    },
  ] as Order[],

  inventory: [
    { sku: 'SCRF-FL-001', productName: 'Silk scarf, floral', productId: 'p3', variantInfo: 'One size',
      onHand: 4, reserved: 2, available: 2, warehouse: 'Istanbul', reorderThreshold: 10,
      movements: [
        { type: 'sale',     delta: -2,  reason: 'Order #GG-10847',      date: 'Today, 14:22' },
        { type: 'received', delta:  20, reason: 'PO from Anatolia Co.', date: '2 days ago' },
        { type: 'sale',     delta: -1,  reason: 'Order #GG-10844',      date: '2 days ago' },
        { type: 'manual',   delta: -3,  reason: 'Damaged in storage',   date: '1 week ago' },
      ],
    },
    { sku: 'KAFT-NV-M', productName: 'Cotton kaftan, navy (Medium)', productId: 'p1', variantInfo: 'Size: Medium · Color: Navy',
      onHand: 14, reserved: 3, available: 11, warehouse: 'Istanbul', reorderThreshold: 8,
      movements: [
        { type: 'sale',     delta: -1,  reason: 'Order #GG-10847', date: 'Today, 14:22' },
        { type: 'sale',     delta: -2,  reason: 'Order #GG-10845', date: 'Yesterday' },
        { type: 'received', delta:  25, reason: 'PO from Aysel',   date: '1 week ago' },
      ],
    },
    { sku: 'KAFT-NV-S', productName: 'Cotton kaftan, navy (Small)', productId: 'p1', variantInfo: 'Size: Small · Color: Navy',
      onHand: 8, reserved: 0, available: 8, warehouse: 'Istanbul', reorderThreshold: 5,
      movements: [{ type: 'received', delta: 10, reason: 'PO from Aysel', date: '1 week ago' }],
    },
    { sku: 'KAFT-NV-L', productName: 'Cotton kaftan, navy (Large)', productId: 'p1', variantInfo: 'Size: Large · Color: Navy',
      onHand: 12, reserved: 0, available: 12, warehouse: 'Istanbul', reorderThreshold: 5,
      movements: [{ type: 'received', delta: 12, reason: 'PO from Aysel', date: '1 week ago' }],
    },
    { sku: 'BLZR-BG-L', productName: 'Linen blazer, beige', productId: 'p2', variantInfo: 'Size: Large',
      onHand: 12, reserved: 1, available: 11, warehouse: 'Istanbul', reorderThreshold: 6,
      movements: [{ type: 'sale', delta: -1, reason: 'Order #GG-10845', date: 'Yesterday' }],
    },
    { sku: 'SAND-LT-42', productName: 'Leather sandals, tan', productId: 'p4', variantInfo: 'Size: 42',
      onHand: 0, reserved: 0, available: 0, warehouse: 'Istanbul', reorderThreshold: 4,
      movements: [{ type: 'sale', delta: -1, reason: 'Order #GG-10822', date: '1 week ago' }],
    },
    { sku: 'TUNC-IV-S', productName: 'Embroidered tunic, ivory', productId: 'p6', variantInfo: 'Size: Small',
      onHand: 22, reserved: 4, available: 18, warehouse: 'Mogadishu', reorderThreshold: 10,
      movements: [{ type: 'received', delta: 30, reason: 'Local supplier', date: '2 weeks ago' }],
    },
  ] as InventoryRow[],

  returns: [
    {
      id: 'RMA-10231', orderId: 'GG-10821', customer: 'Mariam Yusuf', customerEmail: 'm.yusuf@example.com',
      reason: 'wrong-size', reasonNote: 'Ordered M but needs L. Will return for size exchange.',
      status: 'received', decision: 'replace',
      requestedAt: '3 days ago', receivedAt: 'Today',
      items: [{ productId: 'p1', name: 'Cotton kaftan, navy', sku: 'KAFT-NV-M', quantity: 1, price: 48, initial: 'K', restockable: true }],
      refundAmount: 0,
    },
    {
      id: 'RMA-10230', orderId: 'GG-10818', customer: 'David Otieno', customerEmail: 'd.otieno@example.com',
      reason: 'damaged', reasonNote: 'Stitching came loose at the seam after first wear.',
      status: 'inspected', decision: 'full-refund',
      requestedAt: '4 days ago', receivedAt: '2 days ago',
      items: [{ productId: 'p2', name: 'Linen blazer, beige', sku: 'BLZR-BG-L', quantity: 1, price: 112, initial: 'L', restockable: false }],
      refundAmount: 112,
    },
    {
      id: 'RMA-10229', orderId: 'GG-10815', customer: 'Hanna Bekele', customerEmail: 'h.bekele@example.com',
      reason: 'changed-mind',
      status: 'requested',
      requestedAt: '1 day ago',
      items: [{ productId: 'p3', name: 'Silk scarf, floral', sku: 'SCRF-FL-001', quantity: 1, price: 24, initial: 'S', restockable: true }],
      refundAmount: 24,
    },
    {
      id: 'RMA-10228', orderId: 'GG-10812', customer: 'Joyce Wanjiru', customerEmail: 'j.wanjiru@example.com',
      reason: 'not-as-described',
      status: 'refunded', decision: 'partial-refund',
      requestedAt: '1 week ago', receivedAt: '5 days ago', refundedAt: '3 days ago',
      items: [{ productId: 'p4', name: 'Leather sandals, tan', sku: 'SAND-LT-42', quantity: 1, price: 76, initial: 'L', restockable: false }],
      refundAmount: 60, restockingFee: 16,
    },
  ] as Return[],

  messages: [
    {
      id: 'msg-1', customer: 'Amina Hassan', customerEmail: 'amina.h@example.com', orderId: 'GG-10847',
      subject: 'Delivery to Mogadishu — timeline question',
      preview: 'Hi! Is there any chance this could be delivered before Friday?...',
      status: 'unread', lastMessageAt: '2 hours ago', unreadCount: 1,
      messages: [
        { id: 'm1', from: 'customer', body: 'Hi! Is there any chance this could be delivered before Friday? I have a wedding to attend.', sentAt: '2 hours ago' },
      ],
    },
    {
      id: 'msg-2', customer: 'Selam Tadesse', customerEmail: 'selam.t@example.com', orderId: 'GG-10845',
      subject: 'Tracking number confirmation',
      preview: 'Thank you for the quick shipment! I received the tracking number...',
      status: 'replied', lastMessageAt: 'Yesterday', unreadCount: 0,
      messages: [
        { id: 'm2', from: 'customer', body: 'Thank you for the quick shipment! I received the tracking number, can you confirm it shows the correct destination?', sentAt: 'Yesterday, 10:00' },
        { id: 'm3', from: 'seller',   body: 'Hi Selam — yes, tracking JD012345678 is correct for Addis Ababa. Should arrive within 6-10 days.', sentAt: 'Yesterday, 11:42' },
      ],
    },
    {
      id: 'msg-3', customer: 'James Mwangi', customerEmail: 'j.mwangi@example.com',
      subject: 'Sizing question — silk scarves',
      preview: 'What are the exact dimensions of the silk scarves? Looking at the floral one...',
      status: 'unread', lastMessageAt: '3 hours ago', unreadCount: 1,
      messages: [
        { id: 'm4', from: 'customer', body: 'What are the exact dimensions of the silk scarves? Looking at the floral one as a gift.', sentAt: '3 hours ago' },
      ],
    },
    {
      id: 'msg-4', customer: 'Mohamed Ali', customerEmail: 'm.ali@example.com', orderId: 'GG-10842',
      subject: 'Order delivered — thank you!',
      preview: 'Quick note to say everything arrived perfectly. The tunic is beautiful...',
      status: 'read', lastMessageAt: '2 days ago', unreadCount: 0,
      messages: [
        { id: 'm5', from: 'customer', body: 'Quick note to say everything arrived perfectly. The tunic is beautiful and the quality is excellent. Will order again!', sentAt: '2 days ago' },
      ],
    },
  ] as MessageThread[],

  notifications: [
    { id: 'n1', category: 'order',   title: 'New order #GG-10847', body: 'Amina Hassan · $184.20', href: '/orders/GG-10847', read: false, createdAt: '2 hours ago' },
    { id: 'n2', category: 'message', title: 'New message',         body: 'James Mwangi asks about silk scarf sizing', href: '/messages/msg-3', read: false, createdAt: '3 hours ago' },
    { id: 'n3', category: 'stock',   title: 'Low stock alert',     body: 'Silk scarf, floral (SCRF-FL-001) — 4 left', href: '/inventory/SCRF-FL-001', read: false, createdAt: '4 hours ago' },
    { id: 'n4', category: 'payout',  title: 'Payout scheduled',    body: '$2,847.20 will arrive May 15', href: '/finance', read: true, createdAt: 'Yesterday' },
    { id: 'n5', category: 'order',   title: 'Order #GG-10845 shipped', body: 'Tracking JD012345678 assigned', href: '/orders/GG-10845', read: true, createdAt: 'Yesterday' },
    { id: 'n6', category: 'system',  title: 'Weekly digest ready', body: 'View this week\'s performance summary', href: '/finance/reports', read: true, createdAt: '2 days ago' },
  ] as Notification[],

  customers: [
    { id: 'c1', name: 'Amina Hassan',  email: 'amina.h@example.com',  country: 'Somalia',  orders: 7, lifetime:  924.50, lastOrder: 'Today'      },
    { id: 'c2', name: 'Joyce Wanjiru', email: 'j.wanjiru@example.com',country: 'Kenya',    orders: 5, lifetime: 1420.00, lastOrder: '2 days ago' },
    { id: 'c3', name: 'Selam Tadesse', email: 'selam.t@example.com',  country: 'Ethiopia', orders: 3, lifetime:  612.30, lastOrder: '4 days ago' },
    { id: 'c4', name: 'Faisal Omar',   email: 'f.omar@example.com',   country: 'Somalia',  orders: 2, lifetime:  184.80, lastOrder: '1 week ago' },
    { id: 'c5', name: 'Mohamed Ali',   email: 'm.ali@example.com',    country: 'Somalia',  orders: 4, lifetime:  548.20, lastOrder: '4 days ago' },
  ] as Customer[],

  shippingZones: [
    { destination: 'Kenya · Nairobi',        leadTime: '5–8 days',  baseRate: 12, status: 'live'    },
    { destination: 'Somalia · Mogadishu',    leadTime: '7–12 days', baseRate: 18, status: 'live'    },
    { destination: 'Somaliland · Hargeisa',  leadTime: '7–12 days', baseRate: 18, status: 'live'    },
    { destination: 'Ethiopia · Addis Ababa', leadTime: '6–10 days', baseRate: 15, status: 'limited' },
  ] as ShippingZone[],

  promotions: [
    { code: 'EID15',       discount: '15% off',       used: 142, limit: 500,  expires: 'May 17' },
    { code: 'WELCOME10',   discount: '10% off',       used:  89, limit: null, expires: 'Never'  },
    { code: 'FREESHIP-KE', discount: 'Free shipping', used:  34, limit: 200,  expires: 'May 31' },
  ] as Promotion[],

  transactions: [
    { id: 't1', description: 'Order #GG-10843 settled',        amount:   310.00, fee: 8.50, date: 'May 9'  },
    { id: 't2', description: 'Order #GG-10840 settled',        amount:    67.00, fee: 2.35, date: 'May 8'  },
    { id: 't3', description: 'Payout to bank · IBAN ...8472', amount: -1500.00, fee: 0.00, date: 'May 1'  },
    { id: 't4', description: 'Refund · Order #GG-10821',       amount:   -45.20, fee: 0.00, date: 'Apr 30' },
  ] as Transaction[],
};

// ────────────────────────────────────────────────────────────
// Dashboard (computed lazily — values reflect current db state)
// ────────────────────────────────────────────────────────────

export function computeDashboard(): DashboardMetrics {
  const orders = db.orders;
  const products = db.products;
  const inventory = db.inventory;
  const returns = db.returns;
  const messages = db.messages;

  const grossSales = orders.reduce((s, o) => s + o.total, 0);
  const productCost = orders.reduce((s, o) => s + o.subtotal * 0.42, 0);
  const platformFee = grossSales * 0.05;
  const paymentFee = grossSales * 0.029;
  const shippingCost = orders.reduce((s, o) => s + o.shipping, 0);
  const refundCost = returns.filter(r => r.status === 'refunded').reduce((s, r) => s + r.refundAmount, 0);
  const netRevenue = grossSales - platformFee - paymentFee - refundCost;
  const profit = netRevenue - productCost - shippingCost;

  const pendingFulfillment = orders.filter(o => ['confirmed', 'processing', 'picked', 'packed'].includes(o.status)).length;
  const lowStockSkus = inventory.filter(r => r.available <= r.reorderThreshold).length;
  const unrepliedMessages = messages.filter(m => m.status === 'unread').length;
  const pendingReturns = returns.filter(r => ['requested', 'received', 'inspected'].includes(r.status)).length;

  return {
    grossSales, netRevenue, profit,
    ordersToday: 6, ordersThisWeek: orders.length,
    pendingFulfillment, lowStockSkus, unrepliedMessages, pendingReturns,
    weekRevenue: [4640, 3540, 5720, 6730, 4210, 6310, 7570],
    weekProfit:  [1856, 1416, 2288, 2692, 1684, 2524, 3028],
    weekLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    costs: { productCost, platformFee, paymentFee, shippingCost, refundCost },
    health: {
      rating: 4.8,
      onTimeShipmentPct: 96.4,
      cancellationRatePct: 1.2,
      returnRatePct: 3.1,
      responseRatePct: 89,
    },
    actionBoard: {
      fix: [
        { id: 'a1', title: 'Leather sandals out of stock',    detail: 'SAND-LT-42 has had 0 units for 5 days — losing ~$12/day in sales',          href: '/inventory/SAND-LT-42', impact: 'high' },
        { id: 'a2', title: '3 orders past SLA',                detail: 'Should have shipped 2 days ago — risk to on-time rate',                       href: '/orders',               impact: 'high' },
        { id: 'a3', title: '2 unanswered customer messages',   detail: 'Average response time slipping — currently 6h, target is 2h',                 href: '/messages',             impact: 'med'  },
      ],
      watch: [
        { id: 'a4', title: 'Silk scarf below reorder threshold', detail: 'SCRF-FL-001 — 2 available, threshold 10. Sells ~3/week',                    href: '/inventory/SCRF-FL-001', impact: 'med'  },
        { id: 'a5', title: 'Return rate creeping up',            detail: 'Leather sandals: 8.3% return rate vs 3.1% store average',                   href: '/products/p4/analytics', impact: 'med'  },
        { id: 'a6', title: 'Linen blazer conversion dropped',    detail: '2.9% this week vs 4.4% last month — possibly seasonal',                     href: '/products/p2/analytics', impact: 'low'  },
      ],
      scale: [
        { id: 'a7', title: 'Cotton kaftan trending up',          detail: '+47% sales this week. Stock is healthy. Consider featuring on landing page', href: '/products/p1/analytics', impact: 'high' },
        { id: 'a8', title: 'Embroidered tunic — high margin winner', detail: '$1,536 revenue, 1.8% return rate. Consider adding more colorways',     href: '/products/p6/analytics', impact: 'med'  },
        { id: 'a9', title: 'Repeat buyers from Kenya growing',   detail: '47% of Nairobi customers ordered twice. Email campaign worth running',      href: '/marketing',             impact: 'med'  },
      ],
    },
  };
}

export function computeWinningProducts(): ProductLeaderboardEntry[] {
  return [
    { productId: 'p1', name: 'Cotton kaftan, navy',     initial: 'K', imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=80', revenue: 2256, units: 47, changePct:  47 },
    { productId: 'p2', name: 'Linen blazer, beige',     initial: 'L', imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=80', revenue: 2016, units: 18, changePct:  22 },
    { productId: 'p6', name: 'Embroidered tunic, ivory',initial: 'T',                                                                                  revenue: 1536, units: 24, changePct:  18 },
  ];
}

export function computeSlidingProducts(): ProductLeaderboardEntry[] {
  return [
    { productId: 'p4', name: 'Leather sandals, tan',    initial: 'L',                                                                                  revenue:  912, units: 12, changePct: -38 },
    { productId: 'p7', name: 'Hand-loom wrap',          initial: 'W',                                                                                  revenue:  304, units:  8, changePct: -24 },
    { productId: 'p3', name: 'Silk scarf, floral',      initial: 'S', imageUrl: 'https://images.unsplash.com/photo-1601244005535-a48d21d951ac?w=80', revenue:  768, units: 32, changePct: -12 },
  ];
}
