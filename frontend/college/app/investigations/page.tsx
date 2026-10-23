import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCollegeReports } from '../../lib/api';

function riskBadgeClass(severity: string) {
  const s = severity.toLowerCase();
  switch (s) {
    case 'critical': return 'badge badge-critical';
    case 'high': return 'badge badge-high';
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

export default async function CollegeInvestigationsPage() {
  const reports = await fetchCollegeReports();
  const investigations = reports.filter((report) =>
    ['high', 'critical'].includes((report.severity || '').toLowerCase())
  );

  return (
    <AppShell title="Investigations Queue" subtitle="Critical & high risk triage">
      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Open Investigations ({investigations.length})</h2>
            <span className="section-desc">High-risk messages crossing the security threshold that require urgent SOC analyst action.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-critical">{investigations.length} PENDING ACTION</span>
          </div>
        </div>

        {investigations.length === 0 ? (
          <div className="empty-state">No high or critical risk investigations currently open. All incidents handled.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Created</th>
                  <th style={{ width: '140px' }}>Report ID</th>
                  <th>Threat Subject / Title</th>
                  <th style={{ width: '100px' }}>Severity</th>
                  <th style={{ width: '110px' }}>Status</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {investigations.map((report) => (
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
                        {report.title}
                      </Link>
                    </td>
                    <td>
                      <span className={riskBadgeClass(report.severity)}>
                        {report.severity}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-review">UNDER REVIEW</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/reports/${encodeURIComponent(report.report_id)}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Triage →
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
