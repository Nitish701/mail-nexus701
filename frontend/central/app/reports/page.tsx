import { AppShell } from '../../components/AppShell';
import { fetchCentralReports } from '../../lib/api';
import Link from 'next/link';

export default async function CentralReportsPage() {
  const reportResponse = await fetchCentralReports();
  const reports = reportResponse.reports;

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
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Central reports</h2>
        {reports.length === 0 ? (
          <div style={{ color: '#9fb5d8', padding: '24px 0 8px' }}>No security reports are currently available.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {reports.map((report) => (
            <Link key={String(report.report_id)} href={`/reports/${encodeURIComponent(String(report.report_id))}`} style={{ border: '1px solid #243b5b', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: '#0b1221', color: '#e5f0ff', textDecoration: 'none' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{String(report.title || report.report_id || 'Security report')}</div>
                <div style={{ color: '#9fb5d8', marginTop: 4 }}>{String(report.report_id)} • {String(report.report_type || 'report')}</div>
              </div>
              <div style={{ color: '#8ec5ff', fontWeight: 700 }}>{String(report.severity || 'Recorded')} • View details</div>
            </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
