import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCollegeReportDetails } from '../../../lib/api';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Emails', href: '/emails' },
  { label: 'Threats', href: '/threats' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Reports', href: '/reports' }
];

function displayValue(value: unknown): string {
  if (value == null || value === '') return 'Not available';
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(', ') : 'None';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item != null && item !== '');
    return entries.length ? entries.map(([key, item]) => `${key}: ${displayValue(item)}`).join(' · ') : 'Not available';
  }
  return String(value);
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="report-detail-section"><h2>{title}</h2>{children}</section>;
}

export default async function CollegeReportDetailPage({ params }: { params: { reportId: string } }) {
  const report = await fetchCollegeReportDetails(params.reportId);
  const message = report?.message as Record<string, unknown> | undefined;
  const risk = report?.risk as Record<string, unknown> | undefined;
  const advisory = report?.advisory as Record<string, unknown> | undefined;

  return (
    <AppShell title="Email investigation" subtitle="Verified scan evidence" navItems={navItems}>
      <p><Link className="dashboard-action-link" href="/">← Back to dashboard</Link></p>
      {!report ? (
        <section className="data-section"><p className="muted">This report is unavailable or you do not have access to it.</p></section>
      ) : (
        <>
          <section className="workspace-intro">
            <div>
              <div className="eyebrow">Email threat report</div>
              <h2>{String(report.title || params.reportId)}</h2>
              <p>{params.reportId}</p>
            </div>
            <span className={`badge badge-${String(risk?.disposition || report.severity || 'low').toLowerCase()}`}>
              {String(risk?.disposition || report.severity || 'unknown')}
            </span>
          </section>

          <div className="stat-grid">
            <div className="stat-card"><label>Combined risk</label><strong>{displayValue(risk?.base_score)} / {displayValue(risk?.max_score)}</strong></div>
            <div className="stat-card"><label>Sender</label><strong style={{ fontSize: 16 }}>{displayValue(message?.from)}</strong></div>
            <div className="stat-card"><label>Received</label><strong style={{ fontSize: 16 }}>{displayValue(report.created_at || report.generated_at)}</strong></div>
          </div>

          <div className="report-detail-sections">
            <ReportSection title="Message">
              <div className="report-detail-grid">
                <div><label>Subject</label><strong>{displayValue(message?.subject)}</strong></div>
                <div><label>Recipients</label><strong>{displayValue(message?.to)}</strong></div>
                <div><label>Message ID</label><strong>{displayValue(message?.message_id)}</strong></div>
              </div>
            </ReportSection>
            <ReportSection title="Why it was flagged">
              <div className="report-detail-copy">{displayValue(report.findings)}</div>
            </ReportSection>
            <ReportSection title="Authentication checks">
              <div className="report-detail-copy">{displayValue(report.authentication)}</div>
            </ReportSection>
            <ReportSection title="URLs and attachments">
              <div className="report-detail-copy">
                URLs: {displayValue(report.urls)}
                {'\n'}
                Attachments: {displayValue(report.attachments)}
              </div>
            </ReportSection>
            <ReportSection title="Plain-language forensic report">
              <div className="muted" style={{ marginBottom: 8 }}>
                AI explanation: {displayValue(advisory?.ai_status).replace(/_/g, ' ')}
              </div>
              <div className="report-detail-copy">{displayValue(advisory?.detailed_report)}</div>
            </ReportSection>
            <ReportSection title="Recommended next steps">
              <div className="report-detail-copy">{displayValue(advisory?.recommended_actions)}</div>
            </ReportSection>
          </div>
        </>
      )}
    </AppShell>
  );
}
