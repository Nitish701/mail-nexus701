import { AppShell } from '../../components/AppShell';
import { fetchCentralReports } from '../../lib/api';

export default async function CentralLiveFeedPage() {
  const { reports } = await fetchCentralReports();
  return (
    <AppShell
      title="Central Security & Correlation SOC"
      subtitle="Cross-tenant view"
      navItems={[
        { label: 'SOC Overview', href: '/' },
        { label: 'Live Feed', href: '/live-feed' },
        { label: 'Campaigns', href: '/campaigns' },
        { label: 'Investigations', href: '/investigations' },
        { label: 'Threat Intelligence', href: '/threat-intelligence' },
        { label: 'Tenants', href: '/tenants' },
        { label: 'Reports', href: '/reports' },
        { label: 'System Health', href: '/system-health' }
      ]}
    >
      <section style={{ background: '#111827', borderRadius: 16, padding: 24, border: '1px solid #243b5b' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Live threat feed</h2>
        {reports.length === 0 ? <div style={{ color: '#9fb5d8', padding: '24px 0 8px' }}>No suspicious threat events are currently available.</div> : <div style={{ display: 'grid', gap: 12 }}>{reports.map((report) => <div key={String(report.report_id)} style={{ borderTop: '1px solid #243b5b', paddingTop: 12 }}><strong>{String(report.title || 'Suspicious email')}</strong><div style={{ color: '#9fb5d8', marginTop: 4 }}>{String(report.report_id)} · {String(report.severity || 'review')}</div></div>)}</div>}
      </section>
    </AppShell>
  );
}
