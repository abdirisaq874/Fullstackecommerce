import type { Metadata } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import { Toaster } from 'sonner';
import { ReduxProvider } from '@/components/layout/redux-provider';
import { ThemeProvider } from '@/components/layout/theme-provider';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Seller portal · Gaarsii',
  description: 'Manage your store, orders, inventory and finances across the Turkey–East Africa corridor.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` is required by next-themes: the provider
    // injects the resolved theme class on the client before hydration to
    // avoid a flash, which intentionally differs from the SSR markup.
    <html lang="en" className={`${dmSans.variable} ${instrumentSerif.variable}`} suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider>
          <ReduxProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              theme="system"
              toastOptions={{
                classNames: {
                  toast: 'font-sans border border-brand-100 dark:border-forest-900',
                  title: 'text-stone-900 dark:text-stone-100',
                  description: 'text-stone-600 dark:text-stone-300',
                  success: '!bg-brand-50 !text-brand-900 !border-brand-200',
                  error: '!bg-red-50 !text-red-900 !border-red-200',
                },
              }}
            />
          </ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
