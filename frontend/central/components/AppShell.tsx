'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type NavItem = {
  label: string;
  href: string;
};

function getNavIcon(label: string) {
  switch (label) {
    case 'SOC Overview':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case 'Live Feed':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
          <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
        </svg>
      );
    case 'Campaigns':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m4.93 4.93 4.24 4.24" />
          <path d="m14.83 9.17 4.24-4.24" />
          <path d="m14.83 14.83 4.24 4.24" />
          <path d="m9.17 14.83-4.24 4.24" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    case 'Investigations':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'Threat Intelligence':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'Tenants':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'Reports':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'System Health':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
        </svg>
      );
  }
}

export function AppShell({
  title,
  subtitle,
  navItems,
  children,
  actions
}: {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <main className={`soc-shell ${collapsed ? 'soc-sidebar-collapsed' : ''}`}>
      <aside className="soc-sidebar">
        <div className="soc-brand">
          <span className="soc-brand-mark">M</span>
          <span className="soc-brand-copy">
            MAIL-NEXUS
            <small>CENTRAL SOC</small>
          </span>
        </div>
        <button
          type="button"
          className="soc-collapse"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? '›' : '‹'}
        </button>
        <div className="soc-sidebar-label">Operations</div>
        <nav className="soc-sidebar-nav" aria-label="Central SOC navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="soc-nav-link"
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <span className="soc-nav-icon">{getNavIcon(item.label)}</span>
              <span className="soc-nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="soc-sidebar-footer">
          <div className="soc-env-badge">
            <span className="soc-status-dot live" />
            Central environment
          </div>
        </div>
      </aside>
      <div className="soc-main">
        <header className="soc-topbar">
          <div className="soc-topbar-text">
            <div className="soc-kicker">Mail-Nexus · Central SOC</div>
            <h1 className="soc-page-title">{title}</h1>
            <p className="soc-page-subtitle">{subtitle}</p>
          </div>
          <div className="soc-topbar-right">
            {actions}
            <div className="soc-topbar-status">
              <span className="soc-status-dot live" />
              Live
            </div>
          </div>
        </header>
        <div className="soc-content">{children}</div>
      </div>
    </main>
  );
}