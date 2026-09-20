import Link from 'next/link';
import type { ReactNode } from 'react';

type NavItem = {
  label: string;
  href: string;
};

export function AppShell({
  title,
  subtitle,
  navItems,
  children,
  accent = '#3c6bb3'
}: {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  children: ReactNode;
  accent?: string;
}) {
  return (
    <main style={{ fontFamily: 'Arial, sans-serif', background: '#f3f7fb', minHeight: '100vh', color: '#10233d', padding: '32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: accent, fontWeight: 700 }}>Mail-Nexus</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 32 }}>{title}</h1>
          </div>
          <div style={{ background: '#dfeafc', color: '#183b68', borderRadius: 999, padding: '10px 18px', fontWeight: 700 }}>{subtitle}</div>
        </header>

        <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 30 }}>
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} style={{ background: '#ffffff', border: '1px solid #dfeaf6', borderRadius: 10, padding: '10px 16px', fontWeight: 600, color: '#10233d', textDecoration: 'none' }}>
              {item.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </main>
  );
}
