import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralReportDetails } from '../../../lib/api';
import { CENTRAL_NAV } from '../../../lib/nav';

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

export default async function CentralReportDetailPage({
  params
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const report = await fetchCentralReportDetails(reportId);
  const message = report?.message as Record<string, unknown> | undefined;
  const risk = report?.risk as Record<string, unknown> | undefined;
  const advisory = report?.advisory as Record<string, unknown> | undefined;
  const geo = report?.geolocation as Record<string, unknown> | undefined;
  const severity = String(risk?.disposition || report?.severity || 'Not provided');

  return (
    <AppShell title="Forensic Dossier" subtitle={reportId} navItems={[...CENTRAL_NAV]}>
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
            Report &quot;{reportId}&quot; could not be found or access is restricted.
          </div>
        </section>
      ) : (
        <>
          {/* Header Metric Strip */}
          <section className="stat-grid">
            <div className={`stat-card tone-${severity.toLowerCase()}`}>
              <span className="stat-card-label">Severity Level</span>
              <div style={{ marginTop: '4px' }}>
                <span className={riskBadgeClass(severity)} style={{ fontSize: '12px', padding: '4px 8px' }}>
                  {severity.toUpperCase()}
                </span>
              </div>
              <span className="stat-card-detail">Threat Classification</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Combined Score</span>
              <div className="stat-card-value">
                {displayValue(risk?.base_score)}
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
                  {' '}/ {displayValue(risk?.max_score || 70)}
                </span>
              </div>
              <span className="stat-card-detail">Multi-layer scoring</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Campus Node</span>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  marginTop: '4px'
                }}
              >
                {String(report.organization_id || 'Cross-Tenant')}
              </div>
              <span className="stat-card-detail">Institution boundary</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Ingested At</span>
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
              <span className="stat-card-detail">UTC timestamp</span>
            </div>
          </section>

          {/* Detailed Forensic Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px' }}>
            {/* Envelope Details */}
            <div className="data-section">
              <div className="section-title-wrap">
                <h3 className="section-title">Message Envelope</h3>
                <span className="section-desc">Extracted transport headers</span>
              </div>
              <div className="report-code-block">
                <strong>Sender:</strong> {displayValue(message?.from)}
                {'\n'}<strong>Recipient:</strong> {displayValue(message?.to)}
                {'\n'}<strong>Subject:</strong> {displayValue(message?.subject)}
                {'\n'}<strong>Message ID:</strong> {displayValue(message?.message_id)}
              </div>
            </div>

            {/* Authentication Analysis */}
            <div className="data-section">
              <div className="section-title-wrap">
                <h3 className="section-title">Authentication Checks</h3>
                <span className="section-desc">SPF, DKIM, and Return-Path alignment</span>
              </div>
              <div className="report-code-block">
                {displayValue(report.authentication)}
              </div>
            </div>

            {/* Why Flagged */}
            <div className="data-section" style={{ gridColumn: '1 / -1' }}>
              <div className="section-title-wrap">
                <h3 className="section-title">Detection Findings</h3>
                <span className="section-desc">Triggers across Layer 1 (Auth), Layer 2 (Heuristics), Layer 3 (ML), and Layer 4 (YARA)</span>
              </div>
              <div className="report-code-block" style={{ color: 'var(--risk-high)' }}>
                {displayValue(report.findings)}
              </div>
            </div>

            {/* URLs & Attachments */}
            <div className="data-section">
              <div className="section-title-wrap">
                <h3 className="section-title">Extracted URLs</h3>
                <span className="section-desc">Embedded hyperlinks found in email body</span>
              </div>
              <div className="report-code-block">
                {displayValue(report.urls)}
              </div>
            </div>

            <div className="data-section">
              <div className="section-title-wrap">
                <h3 className="section-title">Payloads & Attachments</h3>
                <span className="section-desc">Analyzed files and hashes</span>
              </div>
              <div className="report-code-block">
                {displayValue(report.attachments)}
              </div>
            </div>

            {/* Geolocation */}
            <div className="data-section" style={{ gridColumn: '1 / -1' }}>
              <div className="section-title-wrap">
                <h3 className="section-title">Origin Network & Geolocation</h3>
                <span className="section-desc">Source IP routing infrastructure</span>
              </div>
              <div className="report-code-block">
                IP: {displayValue(geo?.source_ip)} · Country: {displayValue(geo?.country_name)} · ISP/ASN: {displayValue(geo?.isp)}
              </div>
            </div>

            {/* Advisory Report */}
            <div className="data-section" style={{ gridColumn: '1 / -1' }}>
              <div className="section-header">
                <div className="section-title-wrap">
                  <h3 className="section-title">Plain-Language Forensic Advisory</h3>
                  <span className="section-desc">Synthesized threat explanation</span>
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
                <h3 className="section-title">Recommended SOC Remediation</h3>
                <span className="section-desc">Actionable measures for connected tenant nodes</span>
              </div>
              <div
                className="report-code-block"
                style={{
                  borderLeft: '3px solid var(--accent)',
                  color: 'var(--text-primary)'
                }}
              >
                {displayValue(advisory?.recommended_actions || 'Quarantine email from all campus mailboxes and push IOC to perimeter firewalls.')}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
