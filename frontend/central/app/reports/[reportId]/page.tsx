import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralReportDetails } from '../../../lib/api';

const navItems = [
  { label: 'SOC Overview', href: '/' },
  { label: 'Live Feed', href: '/live-feed' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Campaign Graph', href: '/campaign-graph' },
  { label: 'Investigations', href: '/investigations' },
  { label: 'Threat Intelligence', href: '/threat-intelligence' },
  { label: 'Tenants', href: '/tenants' },
  { label: 'Reports', href: '/reports' },
  { label: 'System Health', href: '/system-health' }
];

export default async function CentralReportDetailPage({ params }: { params: { reportId: string } }) {
  const report = await fetchCentralReportDetails(params.reportId);

  return (
    <AppShell title="Central Security & Correlation SOC" subtitle="Report detail" navItems={navItems}>
      <section style={{ background: '#111827', borderRadius: 16, padding: 24, border: '1px solid #243b5b' }}>
        <Link href="/reports" style={{ color: '#8ec5ff', textDecoration: 'none', fontWeight: 700 }}>Back to reports</Link>
        <h2 style={{ margin: '18px 0 6px', fontSize: 22 }}>{String(report?.title || params.reportId)}</h2>
        <div style={{ color: '#9fb5d8', marginBottom: 18 }}>{params.reportId}</div>
        {report ? (
          <pre style={{ margin: 0, padding: 16, background: '#0b1221', border: '1px solid #243b5b', borderRadius: 10, color: '#dbeafe', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'auto', font: '12px/1.6 Consolas, monospace' }}>
            {JSON.stringify(report, null, 2)}
          </pre>
        ) : (
          <div style={{ color: '#fca5a5' }}>This report is not available from the backend.</div>
        )}
      </section>
    </AppShell>
  );
}