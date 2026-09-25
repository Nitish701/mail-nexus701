import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

export default async function CentralInvestigationsPage() {
  const { reports } = await fetchCentralReports();
  return <AppShell title="Central investigations" subtitle="Suspicious activity only" navItems={[...CENTRAL_NAV]}>
    <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24 }}>
      <div style={{ marginBottom: 18 }}><h2 style={{ margin: 0, fontSize: 22 }}>Investigation queue</h2><p style={{ color: '#9fb5d8' }}>Only emails that crossed the suspicious-risk threshold are visible to the central SOC.</p></div>
      {reports.length === 0 ? <div style={{ color: '#9fb5d8', padding: '24px 0 8px' }}>No suspicious investigations are currently available.</div> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ color: '#9fb5d8', textAlign: 'left' }}><th>Report</th><th>Threat</th><th>Risk</th><th>Action</th></tr></thead><tbody>{reports.map((report) => <tr key={String(report.report_id)} style={{ borderTop: '1px solid #243b5b' }}><td style={{ padding: '14px 8px 14px 0' }}>{String(report.report_id)}</td><td style={{ padding: 14 }}>{String(report.title || 'Suspicious email')}</td><td style={{ padding: 14, color: '#fca5a5', fontWeight: 700 }}>{String(report.severity || 'review')}</td><td style={{ padding: 14 }}><Link href={`/reports/${encodeURIComponent(String(report.report_id))}`} style={{ color: '#8ec5ff', fontWeight: 700 }}>Investigate</Link></td></tr>)}</tbody></table>}
    </section>
  </AppShell>;
}
