import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-headline' });

export const metadata: Metadata = {
  title: 'Rivio - Invoice smarter. Get paid faster.',
  description: 'Invoice and payment management for service professionals. Send invoices, accept payments via Stripe, Venmo, or Zelle, and track finances—all in one platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${manrope.variable}`}>
        {children}
      </body>
    </html>
  );
}
