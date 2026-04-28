import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-headline' });

export const metadata: Metadata = {
  title: 'Rivio — PT-first invoicing for physical therapists',
  description: 'The invoicing app built for physical therapists. White-label your clinic, control processing fees, track mileage, and get paid faster from anywhere.',
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
