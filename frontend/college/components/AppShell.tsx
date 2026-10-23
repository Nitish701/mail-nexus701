'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { getCollegeContext } from './CollegeDomainGate';

export type NavItem = {
  label: string;
  href: string;
};

const DEFAULT_COLLEGE_NAV: NavItem[] = [
  { label: 'Overview', href: '/' },
  { label: 'Email Analysis', href: '/emails' },
  { label: 'Threat Alerts', href: '/threats' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Incidents', href: '/investigations' },
  { label: 'Reports', href: '/reports' },
  { label: 'Settings', href: '/settings' }
];

function getNavIcon(label: string) {
  switch (label.toLowerCase()) {
    case 'overview':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case 'email analysis':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'threat alerts':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
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
    case 'incidents':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
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
    case 'settings':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
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
  navItems = DEFAULT_COLLEGE_NAV,
  children,
  actions
}: {
  title?: string;
  subtitle?: string;
  navItems?: NavItem[];
  children: ReactNode;
  actions?: ReactNode;
  accent?: string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const context = getCollegeContext();

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
      <aside className="shell-sidebar" aria-label="College Navigation">
        <div className="sidebar-brand">
          <span className="sidebar-logo-mark" aria-hidden="true">MN</span>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">MAIL-NEXUS</span>
              <span className="sidebar-brand-scope">College Security</span>
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
            <div className="sidebar-tenant-badge" title={context?.domain || 'Institutional Scope'}>
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <strong>{context?.collegeName || 'Campus Scope'}</strong>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {context?.domain || 'Organization Node'}
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
              <span>{title || 'Security Portal'}</span>
              {subtitle && <span className="topbar-subtitle">· {subtitle}</span>}
            </div>
          </div>

          <div className="topbar-right">
            {actions}
            {context && (
              <div className="profile-context" title={context.domain}>
                <span className="profile-avatar" aria-hidden="true">
                  {context.collegeName.slice(0, 1).toUpperCase()}
                </span>
                <span className="profile-context-name">{context.collegeName}</span>
              </div>
            )}
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noreferrer"
              className="portal-switch-link"
              title="Open Central Security Operations Center on port 3001"
            >
              <span>Central SOC</span>
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
