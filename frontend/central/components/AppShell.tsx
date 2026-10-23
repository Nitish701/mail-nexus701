'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { CENTRAL_NAV, type NavItem } from '../lib/nav';

function getNavIcon(label: string) {
  switch (label.toLowerCase()) {
    case 'soc overview':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case 'live feed':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
          <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
        </svg>
      );
    case 'campaigns':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m4.93 4.93 4.24 4.24" />
          <path d="m14.83 9.17 4.24-4.24" />
          <path d="m14.83 14.83 4.24 4.24" />
          <path d="m9.17 14.83-4.24 4.24" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'investigations':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case 'threat intelligence':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'tenants':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'reports':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'system health':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    default:
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}

export function AppShell({
  title,
  subtitle,
  navItems = [...CENTRAL_NAV],
  children,
  actions
}: {
  title?: string;
  subtitle?: string;
  navItems?: NavItem[] | readonly NavItem[];
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isNavActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className={`shell ${isCollapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {mobileOpen && (
        <button
          className="mobile-overlay"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {/* Fixed Left Sidebar */}
      <aside className="shell-sidebar" aria-label="Central SOC Navigation">
        <div className="sidebar-brand">
          <span className="sidebar-logo-mark" aria-hidden="true">MN</span>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">MAIL-NEXUS</span>
              <span className="sidebar-brand-scope">Central SOC</span>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {!isCollapsed && <div className="sidebar-section-label">Operations</div>}
          {navItems.map((item) => {
            const active = isNavActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? 'is-active' : ''}`}
                title={isCollapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{getNavIcon(item.label)}</span>
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!isCollapsed && (
            <div className="sidebar-tenant-badge">
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <strong>Central SOC</strong>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Cross-Tenant Intelligence
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            className="collapse-toggle-btn"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {isCollapsed ? '›' : '‹ Collapse sidebar'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="shell-main">
        {/* Sticky Thin Top Bar */}
        <header className="shell-topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              type="button"
              aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
            >
              <span aria-hidden="true">{mobileOpen ? '×' : '☰'}</span>
            </button>
            <div className="topbar-title">
              <span>{title || 'Central SOC'}</span>
              {subtitle && <span className="topbar-subtitle">· {subtitle}</span>}
            </div>
          </div>

          <div className="topbar-right">
            {actions}
            <div className="profile-context">
              <span className="profile-avatar" aria-hidden="true">S</span>
              <span className="profile-context-name">Central SOC</span>
            </div>
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noreferrer"
              className="portal-switch-link"
              title="Open College Security Portal on port 3000"
            >
              <span>College Portal</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </header>

        {/* Content Body */}
        <main className="shell-content">
          <div onClick={() => mobileOpen && setMobileOpen(false)}>{children}</div>
        </main>
      </div>
    </div>
  );
}
