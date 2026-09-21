import { AppShell } from '../../components/AppShell';
import { fetchCentralHealth, fetchCentralCampaigns, fetchCentralOverview } from '../../lib/api';

export default async function CentralSystemHealthPage() {
  const [health, campaigns, overview] = await Promise.all([fetchCentralHealth(), fetchCentralCampaigns(), fetchCentralOverview()]);
  const detection = overview.totalEmailCount ? Math.round((overview.suspiciousCount / overview.totalEmailCount) * 100) : null;
  const correlation = overview.suspiciousCount ? Math.min(100, Math.round((campaigns.length / overview.suspiciousCount) * 100)) : null;

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
        <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Detection and correlation performance</h2>
        <p style={{ color: '#9fb5d8', marginTop: 0 }}>Observed metrics from currently stored reports and campaign records.</p>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ border: '1px solid #243b5b', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: '#0b1221' }}>
            <div style={{ fontWeight: 700 }}>Correlation API</div>
            <div style={{ color: '#8ec5ff', fontWeight: 700 }}>{String(health.status || 'offline')}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div className="central-report-stat"><small>Detection success</small><strong>{detection == null ? 'N/A' : `${detection}%`}</strong><div style={{ color: '#91a9c7', marginTop: 6, fontSize: 12 }}>Suspicious reports / analyzed emails</div></div>
            <div className="central-report-stat"><small>Correlation success</small><strong>{correlation == null ? 'N/A' : `${correlation}%`}</strong><div style={{ color: '#91a9c7', marginTop: 6, fontSize: 12 }}>Campaigns / suspicious reports</div></div>
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
