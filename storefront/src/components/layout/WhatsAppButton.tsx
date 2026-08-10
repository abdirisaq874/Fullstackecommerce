'use client';

import { useTranslations } from 'next-intl';
import { WHATSAPP_NUMBER, cleanPageUrl, cleanTitle, waLink } from '@/lib/whatsapp';

// Floating "chat with us" button, on every storefront page. The pre-filled
// message carries the page the shopper was on when they tapped it, so an
// incoming WhatsApp message says which product they're asking about instead of
// just "hi".
//
// Number comes from NEXT_PUBLIC_WHATSAPP_NUMBER (baked at build time). Renders
// nothing when unset, so the button simply doesn't appear until it's configured.
export function WhatsAppButton() {
  const t = useTranslations('support');

  if (!WHATSAPP_NUMBER) return null;

  const base = `https://wa.me/${WHATSAPP_NUMBER}`;

  /**
   * Built at click time, not render time: it picks up the live URL including
   * query and hash, and reading `location`/`document` during render would break
   * SSR hydration. The plain href stays a valid chat link, so copy-link and
   * middle-click still work even if this handler never runs.
   */
  const openWithContext = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window === 'undefined') return;
    e.preventDefault();
    const title = cleanTitle(document.title) || t('whatsappThisPage');
    const url = cleanPageUrl(window.location.href);
    const text = t('whatsappMessage', { title, url });
    window.open(waLink(WHATSAPP_NUMBER, text), '_blank', 'noopener,noreferrer');
  };

  return (
    <a
      href={base}
      onClick={openWithContext}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsappAria')}
      title={t('whatsappCta')}
      // z-30: above page content, below the cart drawer and mobile menus (z-50)
      // so it never floats on top of an open overlay.
      className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3
                 text-white shadow-lift outline-none transition
                 hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2
                 sm:bottom-6 sm:right-6"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 shrink-0 fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.347-.347.52-.52.174-.174.232-.298.347-.497.115-.198.058-.371-.025-.52-.083-.148-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.4" />
      </svg>
      {/* Label on wider screens only; the icon alone carries it on phones. */}
      <span className="hidden text-sm font-semibold sm:inline">{t('whatsappCta')}</span>
    </a>
  );
}
