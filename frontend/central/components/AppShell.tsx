'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';

type NavItem = {
  label: string;
  href: string;
};

const navIcons: Record<string, string> = {
  'SOC Overview': '⌂',
  'Live Feed': '◉',
  Campaigns: '◎',
  Investigations: '⌕',
  'Threat Intelligence': '◇',
  Tenants: '◌',
  Reports: '▤',
  'System Health': '◈'
};

function activePath(title: string): string {
  if (title.includes('Campaign')) return title.includes('Graph') ? '/campaign-graph' : '/campaigns';
  if (title.includes('Live')) return '/live-feed';
  if (title.includes('Report')) return '/reports';
  if (title.includes('Investigation')) return '/investigations';
  if (title.includes('Threat')) return '/threat-intelligence';
  if (title.includes('Organization')) return '/tenants';
  if (title.includes('Health')) return '/system-health';
  return '/';
}

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
  const [collapsed, setCollapsed] = useState(false);
  const iconFor = (label: string) => navIcons[label] || '•';
  return (
    <main className={`soc-shell ${collapsed ? 'soc-sidebar-collapsed' : ''}`}>
      <aside className="soc-sidebar">
        <div className="soc-brand"><span className="soc-brand-mark">M</span><span className="soc-brand-copy">MAIL-NEXUS<small>CENTRAL SOC</small></span></div>
        <button type="button" className="soc-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>{collapsed ? '›' : '‹'}</button>
        <div className="soc-sidebar-label">Workspace</div>
        <nav className="soc-sidebar-nav" aria-label="Central SOC navigation">
          {navItems.filter((item) => item.label !== 'Campaign Graph').map((item) => (
            <Link key={item.label} href={item.href} className="soc-nav-link" aria-current={activePath(title) === item.href ? 'page' : undefined} title={item.label}>
              <span className="soc-nav-icon" aria-hidden="true">{iconFor(item.label)}</span><span className="soc-nav-text">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="soc-sidebar-footer"><span className="status-dot" /><span className="soc-nav-text">Systems operational</span></div>
      </aside>
      <div className="soc-main">
        <header className="soc-topbar"><div className="soc-breadcrumb"><span>Central SOC</span><b>/</b><strong>{title}</strong></div><div className="soc-top-actions"><div className="soc-search">⌕ <span>Search investigations</span><kbd>⌘ K</kbd></div><button className="soc-icon-button" type="button" aria-label="Notifications">♢<i /></button><div className="soc-avatar">NS</div></div></header>
        <div className="soc-container">
          <header className="soc-header"><div><div className="soc-kicker" style={{ color: accent }}>MAIL-NEXUS / CENTRAL SECURITY</div><h1>{title}</h1><p className="soc-subtitle">{subtitle}</p></div><div className="soc-view-badge"><span className="status-dot" />Live environment</div></header>
          {children}
        </div>
      </div>
    </main>
  );
}
