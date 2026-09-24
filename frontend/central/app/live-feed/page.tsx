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
      <section className="soc-panel">
        <div className="soc-panel-heading"><h2 className="live-title"><span className="status-dot" />Live threat feed</h2><small>Real-time investigation queue</small></div>
        {reports.length === 0 ? <div className="soc-feed">No suspicious threat events are currently available.</div> : <div className="soc-feed">{reports.map((report) => { const severity = String(report.severity || 'low').toLowerCase(); return <div key={String(report.report_id)} className="soc-feed-item"><span className="soc-feed-title">{String(report.title || 'Suspicious email')}</span><span className="soc-feed-meta"><span className={`severity-pill severity-${severity}`}>{severity}</span>{String(report.report_id)}</span></div>; })}</div>}
      </section>
    </AppShell>
  );
}
