import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCollegeReportDetails } from '../../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function riskBadgeClass(severity: string) {
  const s = severity.toLowerCase();
  switch (s) {
    case 'critical': return 'badge badge-critical';
    case 'high': return 'badge badge-high';
    case 'medium': return 'badge badge-medium';
    case 'review': return 'badge badge-review';
    default: return 'badge badge-review';
  }
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return 'Not available';
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(', ') : 'None';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, item]) => item != null && item !== ''
    );
    return entries.length
      ? entries.map(([key, item]) => `${key}: ${displayValue(item)}`).join(' · ')
      : 'Not available';
  }
  return String(value);
}

export default async function CollegeReportDetailPage({
  params
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const report = await fetchCollegeReportDetails(reportId);
  const message = report?.message as Record<string, unknown> | undefined;
  const risk = report?.risk as Record<string, unknown> | undefined;
  const advisory = report?.advisory as Record<string, unknown> | undefined;
  const severity = String(risk?.disposition || report?.severity || 'Not provided');

  return (
    <AppShell title="Forensic Dossier" subtitle={reportId}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <Link href="/reports" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
          ← Back to report directory
        </Link>
        <div style={{ display: 'flex', gap: 6 }}>
          <a
            href={`${API_URL}/api/reports/${encodeURIComponent(reportId)}?format=json`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            JSON
          </a>
          <a
            href={`${API_URL}/api/reports/${encodeURIComponent(reportId)}?format=csv`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            CSV
          </a>
          <a
            href={`${API_URL}/api/reports/${encodeURIComponent(reportId)}?format=markdown`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Markdown
          </a>
        </div>
      </div>

      {!report ? (
        <section className="data-section">
          <div className="empty-state">
            Report {reportId} could not be located or access is restricted for this tenant node.
          </div>
        </section>
      ) : (
        <>
          {/* Header Metric Strip */}
          <section className="stat-grid">
            <div className={`stat-card tone-${severity.toLowerCase()}`}>
              <span className="stat-card-label">Threat Severity</span>
              <div style={{ marginTop: '4px' }}>
                <span className={riskBadgeClass(severity)} style={{ fontSize: '12px', padding: '4px 8px' }}>
                  {severity.toUpperCase()}
                </span>
              </div>
              <span className="stat-card-detail">Classifier Disposition</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Risk Score</span>
              <div className="stat-card-value">
                {displayValue(risk?.base_score)}
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
                  {' '}/ {displayValue(risk?.max_score)}
                </span>
              </div>
              <span className="stat-card-detail">Calculated multi-layer score</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Origin Sender</span>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  marginTop: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {displayValue(message?.from)}
              </div>
              <span className="stat-card-detail">Header From Address</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Ingestion Timestamp</span>
              <div
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  marginTop: '6px'
                }}
              >
                {displayValue(report.created_at || report.generated_at)}
              </div>
              <span className="stat-card-detail">Local RFC822 ingest time</span>
            </div>
          </section>

          {/* Forensic Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px' }}>
            {/* Envelope & Message Metadata */}
            <div className="data-section">
              <div className="section-title-wrap">
                <h3 className="section-title">Message Envelope</h3>
                <span className="section-desc">Extracted headers from inbound RFC822 transport stream</span>
              </div>
              <div className="report-code-block">
                <strong>Subject:</strong> {displayValue(message?.subject)}
                {'\n'}<strong>Recipients:</strong> {displayValue(message?.to)}
                {'\n'}<strong>Message ID:</strong> {displayValue(message?.message_id)}
                {'\n'}<strong>Report ID:</strong> {reportId}
              </div>
            </div>

            {/* Authentication Analysis */}
            <div className="data-section">
              <div className="section-title-wrap">
                <h3 className="section-title">Authentication Checks</h3>
                <span className="section-desc">SPF, DKIM, DMARC, and sender domain alignment layer</span>
              </div>
              <div className="report-code-block">
                {displayValue(report.authentication)}
              </div>
            </div>

            {/* Why Flagged / Findings */}
            <div className="data-section" style={{ gridColumn: '1 / -1' }}>
              <div className="section-title-wrap">
                <h3 className="section-title">Why This Message Was Flagged</h3>
                <span className="section-desc">Specific heuristic, YARA, ML, and threat intelligence trigger rules</span>
              </div>
              <div className="report-code-block" style={{ color: 'var(--risk-high)' }}>
                {displayValue(report.findings)}
              </div>
            </div>

            {/* URLs & Attachments */}
            <div className="data-section">
              <div className="section-title-wrap">
                <h3 className="section-title">URLs & Embedded Hyperlinks</h3>
                <span className="section-desc">Extracted destinations subjected to reputation checks</span>
              </div>
              <div className="report-code-block">
                {displayValue(report.urls)}
              </div>
            </div>

            <div className="data-section">
              <div className="section-title-wrap">
                <h3 className="section-title">Attachments & Payloads</h3>
                <span className="section-desc">MIME attachments, file hashes, and YARA signatures</span>
              </div>
              <div className="report-code-block">
                {displayValue(report.attachments)}
              </div>
            </div>

            {/* Plain-Language Forensic Report */}
            <div className="data-section" style={{ gridColumn: '1 / -1' }}>
              <div className="section-header">
                <div className="section-title-wrap">
                  <h3 className="section-title">Forensic Assessment & Incident Narrative</h3>
                  <span className="section-desc">Deterministic analysis synthesis for SOC operators</span>
                </div>
                {advisory?.ai_status && (
                  <span className="badge badge-neutral">
                    {displayValue(advisory.ai_status).replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div
                className="report-code-block"
                style={{
                  background: 'var(--bg-canvas)',
                  lineHeight: '1.6',
                  color: 'var(--text-primary)',
                  fontSize: '12px'
                }}
              >
                {displayValue(advisory?.detailed_report || advisory?.summary || 'No advisory summary returned.')}
              </div>
            </div>

            {/* Recommended Action */}
            <div className="data-section" style={{ gridColumn: '1 / -1' }}>
              <div className="section-title-wrap">
                <h3 className="section-title">Recommended SOC Actions</h3>
                <span className="section-desc">Standard operating procedures for campus threat remediation</span>
              </div>
              <div
                className="report-code-block"
                style={{
                  borderLeft: '3px solid var(--accent)',
                  color: 'var(--text-primary)'
                }}
              >
                {displayValue(advisory?.recommended_actions || 'Quarantine email from mailboxes and add sender domain/IP to campus firewall blocklist.')}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
