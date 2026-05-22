import type { Metadata } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import { ReduxProvider } from '@/components/layout/redux-provider';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Seller portal · Gaarsii',
  description: 'Manage your store, orders, inventory and finances across the Turkey–East Africa corridor.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${instrumentSerif.variable}`}>
      <body className="font-sans">
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
