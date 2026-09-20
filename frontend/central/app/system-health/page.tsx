import { AppShell } from '../../components/AppShell';
import { fetchCentralHealth } from '../../lib/api';

export default async function CentralSystemHealthPage() {
  const health = await fetchCentralHealth();

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
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>System health</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ border: '1px solid #243b5b', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: '#0b1221' }}>
            <div style={{ fontWeight: 700 }}>Correlation API</div>
            <div style={{ color: '#8ec5ff', fontWeight: 700 }}>{String(health.status || 'offline')}</div>
          </div>
          <div style={{ border: '1px solid #243b5b', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: '#0b1221' }}>
            <div style={{ fontWeight: 700 }}>Service</div>
            <div style={{ color: '#8ec5ff', fontWeight: 700 }}>{String(health.service || 'unavailable')}</div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
