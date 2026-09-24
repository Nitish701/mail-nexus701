import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mail-Nexus Central SOC',
  description: 'Cross-tenant threat intelligence and correlation dashboard.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
