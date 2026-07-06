import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { Providers } from '@/components/providers';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { SITE_NAME } from '@/lib/utils';

// Space Grotesk throughout (display + body); IBM Plex Mono for utility labels.
const sans = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

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
    <html lang={locale} className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <SiteChrome>{children}</SiteChrome>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
