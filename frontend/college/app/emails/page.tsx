import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCollegeReports } from '../../lib/api';

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

function formatDate(value?: string) {
  if (!value) return 'Time unavailable';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default async function CollegeEmailsPage() {
  const reports = await fetchCollegeReports();

  return (
    <AppShell title="Email Queue" subtitle="Captured messages & scan logs">
      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Analyzed email reports ({reports.length})</h2>
            <span className="section-desc">Persisted email records returned by the Mail Nexus analysis API.</span>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="empty-state">No emails analyzed yet.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Timestamp</th>
                  <th style={{ width: '140px' }}>Report ID</th>
                  <th>Message Subject / Finding</th>
                  <th style={{ width: '90px' }}>Risk</th>
                  <th style={{ width: '90px' }}>Status</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.report_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(report.created_at)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                      {report.report_id}
                    </td>
                    <td>
                      <Link
                        href={`/reports/${encodeURIComponent(report.report_id)}`}
                        className="table-subject-link"
                      >
                        {report.title || 'Untitled report'}
                      </Link>
                    </td>
                    <td>
                      <span className={riskBadgeClass(report.severity)}>
                        {report.severity}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-neutral">ANALYZED</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/reports/${encodeURIComponent(report.report_id)}`}
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
