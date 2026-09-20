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
  accent = '#8ec5ff'
}: {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  children: ReactNode;
  accent?: string;
}) {
  return (
    <main style={{ fontFamily: 'Arial, sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e5f0ff', padding: '32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: accent, fontWeight: 700 }}>Mail-Nexus</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 32 }}>{title}</h1>
          </div>
          <div style={{ background: '#1d4ed8', color: '#eff6ff', borderRadius: 999, padding: '10px 18px', fontWeight: 700 }}>{subtitle}</div>
        </header>

        <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 30 }}>
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} style={{ background: '#111827', border: '1px solid #243b5b', borderRadius: 10, padding: '10px 16px', fontWeight: 600, color: '#e5f0ff', textDecoration: 'none' }}>
              {item.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </main>
  );
}
