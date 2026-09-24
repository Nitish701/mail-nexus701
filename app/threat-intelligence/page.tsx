import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralReportDetails, fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

export default async function ThreatIntelligencePage() {
  const { reports } = await fetchCentralReports();
  const list = Array.isArray(reports) ? reports : [];
  const details = await Promise.all(
    list.map((report) => fetchCentralReportDetails(String(report.report_id)))
  );

  const indicators = details.flatMap((detail, index) => {
    if (!detail) return [];
    const urls = Array.isArray(detail.urls)
      ? detail.urls.map((value) => ({ type: 'URL', value: String(value) }))
      : [];
    const iocs = Array.isArray(detail.iocs)
      ? detail.iocs.map((value) => ({
          type: 'IOC',
          value: typeof value === 'object' ? JSON.stringify(value) : String(value)
        }))
      : [];
    return [...urls, ...iocs].map((indicator) => ({
      ...indicator,
      reportId: String(list[index]?.report_id || '')
    }));
  });

  return (
    <AppShell
      title="Threat intelligence"
      subtitle="Federated indicators from suspicious reports"
      navItems={[...CENTRAL_NAV]}
    >
      <section className="art-section-heading">
        <div>
          <div className="soc-kicker">IOC feed</div>
          <h2>Suspicious indicators</h2>
        </div>
      </section>

      <p style={{ color: '#9fb5d8', marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
        Central visibility is limited to indicators extracted from suspicious messages. Full message
        bodies and personal content remain in the college portal scope.
      </p>

      {indicators.length === 0 ? (
        <div className="art-empty-state">No suspicious indicators are currently available.</div>
      ) : (
        <div
          style={{
            background: '#0b1523',
            border: '1px solid #243b5b',
            borderRadius: 12,
            overflow: 'hidden'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#6e91ad', textAlign: 'left', background: '#0f1a28' }}>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Indicator</th>
                <th style={{ padding: '12px 16px' }}>Source report</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((ind, index) => (
                <tr key={`${ind.reportId}-${index}`} style={{ borderTop: '1px solid #1d344b' }}>
                  <td style={{ padding: '12px 16px' }}>{ind.type}</td>
                  <td style={{ padding: '12px 16px', overflowWrap: 'anywhere', color: '#e5f0ff' }}>
                    {ind.value}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link
                      href={`/reports/${encodeURIComponent(ind.reportId)}`}
                      className="art-inline-link"
                    >
                      {ind.reportId}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
