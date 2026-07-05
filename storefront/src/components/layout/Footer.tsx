import Link from 'next/link';
import { SITE_NAME } from '@/lib/utils';
import { NewsletterForm } from './NewsletterForm';

const cols = [
  {
    title: 'Shop',
    links: [
      { label: 'All products', href: '/search' },
      { label: 'New arrivals', href: '/search?sortBy=newest' },
      { label: 'Bestsellers', href: '/search?sortBy=popular' },
      { label: 'Deals', href: '/search?sortBy=price_asc' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'My account', href: '/account' },
      { label: 'Orders', href: '/account/orders' },
      { label: 'Wishlist', href: '/wishlist' },
      { label: 'Returns', href: '/account/returns' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Help center', href: '/help' },
      { label: 'Shipping', href: '/help#shipping' },
      { label: 'Returns policy', href: '/help#returns' },
      { label: 'Contact us', href: '/help#contact' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/help#about' },
      { label: 'Privacy', href: '/help#privacy' },
      { label: 'Terms', href: '/help#terms' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-muted/40">
      <div className="container py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <span className="font-display text-2xl font-semibold tracking-tight text-brand">{SITE_NAME}</span>
            <p className="mt-3 max-w-xs text-sm text-muted-fg">
              A bold, modern marketplace. Multilingual search, fast checkout, fair prices.
            </p>
            <NewsletterForm />
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">{col.title}</h3>
              <ul className="space-y-2 text-sm text-muted-fg">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="hover:text-brand">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted-fg sm:flex-row">
          <p>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
          <p className="flex items-center gap-2">Secure payments by <span className="font-semibold text-ink">Stripe</span></p>
        </div>
      </div>
    </footer>
  );
}
