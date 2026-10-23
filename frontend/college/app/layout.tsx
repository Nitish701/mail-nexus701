import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CollegeDomainGate } from '../components/CollegeDomainGate';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: 'Mail-Nexus Organization Security Portal',
  description: 'Organization-wide email security, threat monitoring, and incident response.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body><CollegeDomainGate>{children}</CollegeDomainGate></body>
    </html>
  );
}
