// Meta (Facebook) Pixel — a thin, typed wrapper around the global `fbq()`.
//
// The base loader script is injected once in <MetaPixel /> (rendered from the
// root layout). Every helper below is a safe no-op until that script has loaded
// (or when no pixel id is configured), so callers never have to guard.
//
// IMPORTANT: `content_ids` must equal the product `id` in our catalog feed
// (`/feed/facebook.xml`), which is the product **slug**. Always pass slugs here,
// never Mongo ids — otherwise Meta can't match activity to catalog products.

// The dataset/pixel id is public (it ships in client JS), so a hardcoded default
// is fine; NEXT_PUBLIC_META_PIXEL_ID can override it per environment.
export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || '1638279067369914';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function fbq(...args: unknown[]): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq(...args);
}

export function pageView(): void {
  fbq('track', 'PageView');
}

/**
 * Read the Meta `_fbp` (browser id) and `_fbc` (click id) cookies so they can be
 * forwarded to the server-side Conversions API for identity matching + browser
 * dedup. Returns empty when unavailable (SSR, cookies blocked).
 */
export function getMetaCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === 'undefined') return {};
  const read = (name: string): string | undefined => {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : undefined;
  };
  return { fbp: read('_fbp'), fbc: read('_fbc') };
}

export function viewContent(p: {
  id: string;
  name?: string;
  value?: number;
  currency?: string;
}): void {
  fbq('track', 'ViewContent', {
    content_ids: [p.id],
    content_type: 'product',
    content_name: p.name,
    value: p.value,
    currency: p.currency || 'USD',
  });
}

export function addToCart(p: {
  id: string;
  name?: string;
  quantity?: number;
  value?: number;
  currency?: string;
}): void {
  fbq('track', 'AddToCart', {
    content_ids: [p.id],
    content_type: 'product',
    content_name: p.name,
    contents: [{ id: p.id, quantity: p.quantity ?? 1 }],
    value: p.value,
    currency: p.currency || 'USD',
  });
}

export function initiateCheckout(p: {
  ids: string[];
  value: number;
  currency?: string;
  numItems?: number;
}): void {
  fbq('track', 'InitiateCheckout', {
    content_ids: p.ids,
    content_type: 'product',
    value: p.value,
    currency: p.currency || 'USD',
    num_items: p.numItems ?? p.ids.length,
  });
}

export function purchase(p: {
  ids: string[];
  value: number;
  currency?: string;
  numItems?: number;
  contents?: { id: string; quantity: number }[];
  // Shared with the server-side Conversions API event so Meta de-duplicates
  // the browser + server Purchase into one. Use the order id.
  eventId?: string;
}): void {
  const params = {
    content_ids: p.ids,
    content_type: 'product',
    contents: p.contents,
    value: p.value,
    currency: p.currency || 'USD',
    num_items: p.numItems ?? p.ids.length,
  };
  if (p.eventId) fbq('track', 'Purchase', params, { eventID: p.eventId });
  else fbq('track', 'Purchase', params);
}
