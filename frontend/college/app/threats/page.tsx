import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCollegeReportDetails, fetchCollegeReports } from '../../lib/api';

function riskBadgeClass(severity: string) {
  const s = severity.toLowerCase();
  switch (s) {
    case 'critical': return 'badge badge-critical';
    case 'high': return 'badge badge-high';
    case 'medium': return 'badge badge-medium';
    case 'review': return 'badge badge-review';
    default: return 'badge badge-neutral';
  }
}

export default async function CollegeThreatsPage() {
  const reports = await fetchCollegeReports();
  const details = await Promise.all(
    reports.map((report) => fetchCollegeReportDetails(report.report_id))
  );

  const threats = details.flatMap((detail, index) =>
    (detail?.findings as string[] | undefined || []).map((finding) => ({
      finding,
      report: reports[index]
    }))
  );

  return (
    <AppShell title="Threat Intelligence" subtitle="Extracted indicators & heuristic signals">
      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Observed Threat Signals ({threats.length})</h2>
            <span className="section-desc">Heuristic, YARA, ML, and authentication findings extracted from processed mail.</span>
          </div>
          <Link href="/reports" className="btn btn-secondary btn-sm">
            Inspect source reports →
          </Link>
        </div>

        {threats.length === 0 ? (
          <div className="empty-state">No threat signals or anomalies detected in the current scope.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Signal / Heuristic Finding</th>
                  <th style={{ width: '160px' }}>Source Report</th>
                  <th style={{ width: '100px' }}>Severity</th>
                  <th style={{ width: '110px' }}>Status</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {threats.map((item, index) => (
                  <tr key={`${item.report.report_id}-${index}`}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {item.finding}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                      {item.report.report_id}
                    </td>
                    <td>
                      <span className={riskBadgeClass(item.report.severity)}>
                        {item.report.severity}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-neutral">FLAGGED</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/reports/${encodeURIComponent(item.report.report_id)}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
