import type { Metadata } from 'next';
import { Sora, Manrope } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { Providers } from '@/components/providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { SITE_NAME } from '@/lib/utils';

// Manrope — warm, highly legible body; Sora — geometric, confident display.
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — Shop the bold`, template: `%s · ${SITE_NAME}` },
  description: `${SITE_NAME} is a modern multilingual marketplace. Shop electronics, fashion, home and more.`,
  metadataBase: new URL('http://localhost:3001'),
  openGraph: { title: SITE_NAME, type: 'website' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${sans.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <CartDrawer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
