import { AppShell } from '../../components/AppShell';
import { fetchCentralReportDetails, fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

export default async function ThreatIntelligencePage() {
  const { reports } = await fetchCentralReports();
  const details = await Promise.all(reports.map((report) => fetchCentralReportDetails(String(report.report_id))));
  const indicators = details.flatMap((detail, index) => {
    if (!detail) return [];
    const urls = Array.isArray(detail.urls) ? detail.urls.map((value) => ({ type: 'URL', value })) : [];
    const iocs = Array.isArray(detail.iocs) ? detail.iocs.map((value) => ({ type: 'IOC', value: typeof value === 'object' ? JSON.stringify(value) : value })) : [];
    return [...urls, ...iocs].map((indicator) => ({ ...indicator, report: reports[index] }));
  });
  return <AppShell title="Threat intelligence" subtitle="Federated indicators" navItems={[...CENTRAL_NAV]}>
    <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24 }}><div style={{ marginBottom: 18 }}><h2 style={{ margin: 0, fontSize: 22 }}>Suspicious indicators</h2><p style={{ color: '#9fb5d8' }}>Central visibility is limited to indicators from suspicious messages. Message bodies and personal content remain in the college scope.</p></div>{indicators.length === 0 ? <div style={{ color: '#9fb5d8', padding: '24px 0 8px' }}>No suspicious indicators are currently available.</div> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ color: '#9fb5d8', textAlign: 'left' }}><th>Type</th><th>Indicator</th><th>Source report</th></tr></thead><tbody>{indicators.map((indicator, index) => <tr key={`${indicator.report.report_id}-${index}`} style={{ borderTop: '1px solid #243b5b' }}><td style={{ padding: 14 }}>{indicator.type}</td><td style={{ padding: 14, overflowWrap: 'anywhere' }}>{String(indicator.value)}</td><td style={{ padding: 14 }}>{String(indicator.report.report_id)}</td></tr>)}</tbody></table>}</section>
  </AppShell>;
}
