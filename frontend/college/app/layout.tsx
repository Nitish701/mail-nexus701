import type { Metadata } from 'next';
import './globals.css';
import { CollegeDomainGate } from '../components/CollegeDomainGate';

export const metadata: Metadata = {
  title: 'Mail-Nexus Organization Security Portal',
  description: 'Organization-wide email security, threat monitoring, and incident response.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><CollegeDomainGate>{children}</CollegeDomainGate></body>
    </html>
  );
}
