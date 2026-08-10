// Pure helpers behind the floating WhatsApp button. Kept free of React and of
// `window` so the link-building rules (number normalisation, tracking-param
// stripping, title cleanup) are testable on their own.

/** Configured support number, baked at build time. Empty = button hidden. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');

// Click-id and campaign params are noise to whoever reads the message.
const TRACKING_PARAMS = [
  'fbclid', 'gclid', 'ttclid', 'msclkid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
];

/**
 * Drop tracking params so the merchant gets a clean, shareable product link.
 * Returns the input unchanged if it isn't a parseable absolute URL.
 */
export function cleanPageUrl(href: string): string {
  try {
    const url = new URL(href);
    TRACKING_PARAMS.forEach((p) => url.searchParams.delete(p));
    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Page title reduced to the bit worth reading. Next renders titles as
 * "Product name · Suuq", so everything from the separator on is dropped.
 */
export function cleanTitle(documentTitle: string): string {
  return (documentTitle || '').split(/[·|]/)[0].trim();
}

/** wa.me link carrying an already-composed message. */
export function waLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
