'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCollegeContext } from './CollegeDomainGate';

type NavItem = {
  label: string;
  href: string;
};

export function AppShell({
  title,
  subtitle,
  navItems,
  children,
  accent = '#f08a4b'
}: {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  children: ReactNode;
  accent?: string;
}) {
  const context = getCollegeContext();
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Mail-Nexus Organization Security Portal';
  return (
    <main className="app-shell">
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header className="shell-header">
          <div>
            <div className="live-indicator"><span className="live-dot" /> LIVE</div>
            <div className="eyebrow" style={{ color: accent }}>Mail Nexus</div>
            <h1>{title}</h1>
            {context && <div className="college-context">{context.collegeName} <span>{context.domain}</span></div>}
          </div>
          <div className="shell-identity"><strong>{context?.collegeName || appName}</strong><span>{subtitle}</span></div>
        </header>

        <nav className="shell-nav" aria-label="College navigation">
          {navItems.map((item, index) => (
            <Link key={item.label} href={item.href} className="nav-link">
              <span>{String(index + 1).padStart(2, '0')}</span>{item.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </main>
  );
}
