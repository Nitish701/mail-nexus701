import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mail-Nexus Organization Security Portal',
  description: 'Organization-wide email security, threat monitoring, and incident response.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
