import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralReportDetails } from '../../../lib/api';
import { CENTRAL_NAV } from '../../../lib/nav';

function Field({ label, value, isCode }: { label: string; value: unknown; isCode?: boolean }) {
  return (
    <div className="report-field">
      <div className="report-field-label">{label}</div>
      <div className={`report-field-value ${isCode ? 'report-code-font' : ''}`} style={isCode ? { fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: 12, wordBreak: 'break-all' } : {}}>
        {value == null || value === '' ? (
          <span style={{ color: '#5b7394' }}>Not available / omitted for privacy</span>
        ) : typeof value === 'object' ? (
          <pre style={{ margin: 0, padding: 8, background: '#0a101d', borderRadius: 6, fontSize: 11, overflowX: 'auto' }}>
            {JSON.stringify(value, null, 2)}
          </pre>
        ) : (
          String(value)
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="soc-card" style={{ marginBottom: 16 }}>
      <div className="soc-card-header" style={{ padding: '16px 20px' }}>
        <h3 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.8, color: '#8ec5ff' }}>
          {title}
        </h3>
      </div>
      <div className="soc-card-body" style={{ padding: '8px 20px 16px' }}>
        {children}
      </div>
    </section>
  );
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return 'Not available';
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(item)).join(', ') : 'None';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.entries(record).filter(([, item]) => item != null && item !== '');
    if (!entries.length) return 'Not available';
    return entries.map(([key, item]) => `${key}: ${formatValue(item)}`).join(' • ');
  }
  return String(value);
}

export default async function CentralReportDetailPage({ params }: { params: { reportId: string } }) {
  const report = await fetchCentralReportDetails(params.reportId);
  const message = report?.message as Record<string, unknown> | undefined;
  const risk = report?.risk as Record<string, unknown> | undefined;
  const geo = report?.geolocation as Record<string, unknown> | undefined;
  const fingerprint = report?.fingerprint as Record<string, unknown> | undefined;

  const sev = String(report?.severity || 'unknown').toLowerCase();
  const riskScore = Number(risk?.base_score ?? (sev === 'critical' ? 65 : sev === 'high' ? 52 : 30));
  const maxRisk = 70;
  const riskPct = Math.min(100, Math.round((riskScore / maxRisk) * 100));

  return (
    <AppShell title="Central Investigation Forensic Report" subtitle="Federated evidence dossier" navItems={[...CENTRAL_NAV]}>
      <div className="soc-subpage">
        <Link href="/reports" className="report-back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          ← Back to report directory
        </Link>

        {report ? (
          <>
            <header className="report-hero">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div className="report-hero-kicker">MAIL-NEXUS · FEDERATED FORENSIC DOSSIER</div>
                <span className={`soc-badge ${sev}`}>{sev} severity</span>
              </div>
              <h2 style={{ fontSize: 24, margin: '8px 0' }}>{String(report.title || params.reportId)}</h2>
              <div className="report-hero-meta">
                Identifier: <span style={{ color: '#8ec5ff' }}>{params.reportId}</span> · Organization {String(report.organization_id || 'Cross-Tenant')}
              </div>
            </header>

            {/* KPI Stat Grid */}
            <div className="report-stat-grid">
              <div className="soc-card" style={{ padding: 16 }}>
                <small style={{ color: '#7a91ad', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Investigation Status</small>
                <div style={{ marginTop: 6 }}>
                  <span className="soc-badge high">UNDER REVIEW</span>
                </div>
              </div>

              <div className="soc-card" style={{ padding: 16 }}>
                <small style={{ color: '#7a91ad', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Severity Rating</small>
                <div style={{ marginTop: 6 }}>
                  <span className={`soc-badge ${sev}`}>{sev.toUpperCase()}</span>
                </div>
              </div>

              <div className="soc-card" style={{ padding: 16 }}>
                <small style={{ color: '#7a91ad', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Composite Risk Meter</small>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <strong style={{ color: '#f1f5fb', fontSize: 18, fontFamily: '"JetBrains Mono", monospace' }}>
                    {riskScore} / {maxRisk}
                  </strong>
                  <div className="soc-risk-bar" style={{ flex: 1 }}>
                    <div className={`soc-risk-fill ${sev}`} style={{ width: `${riskPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="soc-card" style={{ padding: 16 }}>
                <small style={{ color: '#7a91ad', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Origin Scope</small>
                <div style={{ color: '#8ec5ff', fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                  Campus Tenant {String(report.organization_id || 'Shared')}
                </div>
              </div>
            </div>

            {/* Privacy boundary */}
            <aside className="central-privacy-note">
              <span aria-hidden="true">🔒</span>
              <p>
                <strong>Privacy Protocol Active</strong> Raw recipient inboxes and message body texts are excluded from the central dossier. Only cryptographic fingerprints, header indicators, and network telemetry are correlated.
              </p>
            </aside>

            {/* Sections */}
            <Section title="Executive Threat Advisory">
              <p style={{ margin: 0, color: '#dbeafe', lineHeight: 1.7, fontSize: 14 }}>
                {String((report.advisory as Record<string, unknown> | undefined)?.summary || 'Investigation evidence and correlated telemetry are detailed below.')}
              </p>
            </Section>

            <Section title="Email Header & Sender Intelligence">
              <Field label="Message ID" value={message?.message_id} isCode />
              <Field label="Sender Address" value={message?.from} />
              <Field label="Target Recipient Scope" value={Array.isArray(message?.to) ? message?.to.join(', ') : message?.to} />
              <Field label="Subject Line" value={message?.subject} />
            </Section>

            <Section title="Extracted Threat Indicators">
              <Field label="Detections & Findings" value={Array.isArray(report.findings) ? report.findings.join(' • ') : formatValue(report.findings)} />
              <Field label="Malicious URLs" value={Array.isArray(report.urls) ? report.urls.join(', ') : formatValue(report.urls)} isCode />
              <Field label="Observed IOCs" value={Array.isArray(report.iocs) ? report.iocs.join(' • ') : formatValue(report.iocs)} isCode />
              <Field
                label="Attachments"
                value={
                  Array.isArray(report.attachments)
                    ? report.attachments
                        .map((att) =>
                          typeof att === 'object' && att
                            ? `${(att as Record<string, unknown>).filename || 'Attachment'} (${(att as Record<string, unknown>).content_type || 'unknown'})`
                            : String(att)
                        )
                        .join(', ')
                    : formatValue(report.attachments)
                }
              />
              <Field label="Threat Feed / VirusTotal" value={formatValue(report.virustotal)} />
            </Section>

            <Section title="Authentication Validation & Detection Layers">
              <Field label="SPF / DKIM / DMARC" value={formatValue(report.authentication)} />
              <Field label="Inspection Layers" value={formatValue(report.layers)} />
            </Section>

            <Section title="Infrastructure & Geolocation Assessment">
              <Field label="Source Host IP" value={geo?.source_ip} isCode />
              <Field label="Country / Region / City" value={[geo?.country, geo?.region, geo?.city].filter(Boolean).join(' / ')} />
              <Field label="Autonomous System (ASN)" value={geo?.asn} />
              <Field label="VPN / Proxy Node Flag" value={geo?.is_vpn_proxy ? 'Identified VPN/Proxy Anonymizer' : 'Direct Host Connection'} />
              <Field label="Attribution Confidence" value={geo?.confidence != null ? `${Math.round(Number(geo.confidence) * 100)}%` : null} />
            </Section>

            <Section title="Cryptographic Forensic Fingerprint">
              <Field label="Email Body SHA-256" value={fingerprint?.body_sha256} isCode />
              <Field label="Trend Micro TLSH Hash" value={fingerprint?.tlsh} isCode />
              <Field label="Extracted IOC Count" value={fingerprint?.ioc_count} />
            </Section>
          </>
        ) : (
          <div className="soc-card" style={{ padding: 40, textAlign: 'center' }}>
            <h3 style={{ color: '#ff6e6e', margin: '0 0 10px' }}>Investigation Dossier Unavailable</h3>
            <p style={{ color: '#8fa2bd', margin: '0 0 16px' }}>
              The requested report identifier does not match any current investigation record.
            </p>
            <Link href="/reports" className="btn-primary" style={{ display: 'inline-block' }}>
              Return to Report Directory
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
