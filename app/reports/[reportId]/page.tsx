import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralReportDetails } from '../../../lib/api';
import { CENTRAL_NAV } from '../../../lib/nav';

export default async function ReportDetailPage({
  params
}: {
  params: { reportId: string };
}) {
  const reportId = decodeURIComponent(params.reportId);
  const report = await fetchCentralReportDetails(reportId);

  if (!report) {
    return (
      <AppShell title="Report not found" subtitle={reportId} navItems={[...CENTRAL_NAV]}>
        <div className="art-empty-state">
          Report <code>{reportId}</code> could not be loaded.
          <div style={{ marginTop: 16 }}>
            <Link href="/reports" className="art-inline-link">
              ← Back to reports
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const severity = String(report.severity || 'unknown').toLowerCase();
  const urls = Array.isArray(report.urls) ? report.urls : [];
  const iocs = Array.isArray(report.iocs) ? report.iocs : [];

  return (
    <AppShell
      title={`Report ${reportId}`}
      subtitle="Structured threat report (central view)"
      navItems={[...CENTRAL_NAV]}
    >
      <div style={{ marginBottom: 20 }}>
        <Link href="/reports" className="art-inline-link">
          ← All reports
        </Link>
      </div>

      <section className="report-stat-grid" style={{ marginBottom: 24 }}>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Severity</div>
            <strong className={`severity-pill severity-${severity}`} style={{ fontSize: 14 }}>
              {severity.toUpperCase()}
            </strong>
          </div>
        </div>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Type</div>
            <strong style={{ fontSize: 16 }}>{String(report.report_type || 'email')}</strong>
          </div>
        </div>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Created</div>
            <strong style={{ fontSize: 14 }}>{String(report.created_at || '—')}</strong>
          </div>
        </div>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Score</div>
            <strong style={{ fontSize: 22 }}>
              {report.score != null ? String(report.score) : '—'}
            </strong>
          </div>
        </div>
      </section>

      {report.summary || report.advisory ? (
        <section
          style={{
            background: '#0f1a28',
            border: '1px solid #243b5b',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            color: '#c5d8ef',
            lineHeight: 1.6
          }}
        >
          <div className="soc-kicker" style={{ marginBottom: 8 }}>
            Advisory / summary
          </div>
          {String(report.summary || report.advisory || '')}
        </section>
      ) : null}

      <section className="art-section-heading">
        <div>
          <div className="soc-kicker">Indicators</div>
          <h2>URLs & IOCs</h2>
        </div>
      </section>

      {urls.length === 0 && iocs.length === 0 ? (
        <div className="art-empty-state">No indicators attached to this report.</div>
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
                <th style={{ padding: '12px 16px' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {urls.map((u, i) => (
                <tr key={`url-${i}`} style={{ borderTop: '1px solid #1d344b' }}>
                  <td style={{ padding: '12px 16px' }}>URL</td>
                  <td style={{ padding: '12px 16px', overflowWrap: 'anywhere' }}>
                    {String(u)}
                  </td>
                </tr>
              ))}
              {iocs.map((ioc, i) => (
                <tr key={`ioc-${i}`} style={{ borderTop: '1px solid #1d344b' }}>
                  <td style={{ padding: '12px 16px' }}>IOC</td>
                  <td style={{ padding: '12px 16px', overflowWrap: 'anywhere' }}>
                    {typeof ioc === 'object' ? JSON.stringify(ioc) : String(ioc)}
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
