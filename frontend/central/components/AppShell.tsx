'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type NavItem = {
  label: string;
  href: string;
};

const navIcons: Record<string, string> = {
  'SOC Overview': '◆',
  'Live Feed': '●',
  Campaigns: '◎',
  Investigations: '⌕',
  'Threat Intelligence': '◇',
  Tenants: '▣',
  Reports: '▤',
  'System Health': '◈'
};

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
              <span className="soc-nav-icon">{navIcons[item.label] || '•'}</span>
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