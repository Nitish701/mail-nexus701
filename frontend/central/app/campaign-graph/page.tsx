import { AppShell } from '../../components/AppShell';

export default function CampaignGraphPage() {
  return (
    <AppShell
      title="Central Security & Correlation SOC"
      subtitle="Cross-tenant view"
      navItems={[
        { label: 'SOC Overview', href: '/' },
        { label: 'Live Feed', href: '/live-feed' },
        { label: 'Campaigns', href: '/campaigns' },
        { label: 'Campaign Graph', href: '/campaign-graph' },
        { label: 'Investigations', href: '/investigations' },
        { label: 'Threat Intelligence', href: '/threat-intelligence' },
        { label: 'Tenants', href: '/tenants' },
        { label: 'Reports', href: '/reports' },
        { label: 'System Health', href: '/system-health' }
      ]}
    >
      <section style={{ background: '#111827', borderRadius: 16, padding: 24, border: '1px solid #243b5b' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Campaign graph</h2>
        <div style={{ position: 'relative', minHeight: 180, background: '#0b1221', borderRadius: 12, border: '1px solid #1f2a3d', overflow: 'hidden', display: 'grid', placeItems: 'center', color: '#9fb5d8', padding: 24, textAlign: 'center' }}>
          No campaign graph data is currently available.
        </div>
      </section>
    </AppShell>
  );
}
