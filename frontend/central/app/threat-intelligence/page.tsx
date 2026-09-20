import { AppShell } from '../../components/AppShell';

const navItems = [
  { label: 'SOC Overview', href: '/' },
  { label: 'Live Feed', href: '/live-feed' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Investigations', href: '/investigations' },
  { label: 'Threat Intelligence', href: '/threat-intelligence' },
  { label: 'Tenants', href: '/tenants' },
  { label: 'Reports', href: '/reports' },
  { label: 'System Health', href: '/system-health' }
];

export default function ThreatIntelligencePage() {
  return (
    <AppShell title="Central Security & Correlation SOC" subtitle="Cross-tenant view" navItems={navItems}>
      <section style={{ background: '#111827', borderRadius: 16, padding: 24, border: '1px solid #243b5b' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Threat intelligence</h2>
        <div style={{ color: '#9fb5d8', padding: '24px 0 8px' }}>
          No federated threat intelligence is currently available.
        </div>
      </section>
    </AppShell>
  );
}
