import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralReportDetails } from '../../../lib/api';
import { CENTRAL_NAV } from '../../../lib/nav';

function Field({ label, value }: { label: string; value: unknown }) { return <div className="report-field"><div className="report-field-label">{label}</div><div className="report-field-value">{value == null || value === '' ? 'Not available' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</div></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="report-section"><h3>{title}</h3>{children}</section>; }

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
  return <AppShell title="Central investigation report" subtitle="Formal investigation" navItems={[...CENTRAL_NAV]}>
    <div className="report-detail-layout"><Link href="/reports" className="report-back-link">Back to reports</Link>{report ? <>
      <header className="report-hero"><div className="report-hero-kicker">MAIL-NEXUS / CENTRAL INVESTIGATION</div><h2>{String(report.title || params.reportId)}</h2><div className="report-hero-meta">{params.reportId} · Suspicious activity shared for central correlation</div></header>
      <div className="report-stat-grid"><div className="central-report-stat"><small>Status</small><strong>UNDER REVIEW</strong></div><div className="central-report-stat"><small>Severity</small><strong>{String(report.severity || 'Unknown')}</strong></div><div className="central-report-stat"><small>Risk score</small><strong>{String(risk?.base_score ?? 'N/A')} / 70</strong></div><div className="central-report-stat"><small>Source</small><strong>Organization {String(report.organization_id || 'scoped')}</strong></div></div>
      <Section title="Executive summary"><p style={{ margin: 0, color: '#dbeafe', lineHeight: 1.7 }}>{String((report.advisory as Record<string, unknown> | undefined)?.summary || 'Investigation evidence is available below.')}</p></Section>
      <Section title="Email intelligence"><Field label="Message ID" value={message?.message_id} /><Field label="Sender" value={message?.from} /><Field label="Recipient" value={Array.isArray(message?.to) ? message?.to.join(', ') : message?.to} /><Field label="Subject" value={message?.subject} /></Section>
      <Section title="Threat intelligence"><Field label="Findings" value={Array.isArray(report.findings) ? report.findings.join(' • ') : formatValue(report.findings)} /><Field label="URLs" value={Array.isArray(report.urls) ? report.urls.join(', ') : formatValue(report.urls)} /><Field label="IOCs" value={Array.isArray(report.iocs) ? report.iocs.join(' • ') : formatValue(report.iocs)} /><Field label="Attachments" value={Array.isArray(report.attachments) ? report.attachments.map((attachment) => (typeof attachment === 'object' && attachment ? `${(attachment as Record<string, unknown>).filename || 'Attachment'} (${(attachment as Record<string, unknown>).content_type || 'unknown'})` : String(attachment))).join(', ') : formatValue(report.attachments)} /><Field label="VirusTotal" value={formatValue(report.virustotal)} /></Section>
      <Section title="Authentication and detection"><Field label="Authentication" value={formatValue(report.authentication)} /><Field label="Detection layers" value={formatValue(report.layers)} /></Section>
      <Section title="Geolocation assessment"><Field label="Source IP" value={geo?.source_ip} /><Field label="Country / region / city" value={[geo?.country, geo?.region, geo?.city].filter(Boolean).join(' / ')} /><Field label="ASN" value={geo?.asn} /><Field label="VPN / proxy" value={geo?.is_vpn_proxy} /><Field label="Confidence" value={geo?.confidence != null ? `${Math.round(Number(geo.confidence) * 100)}%` : null} /></Section>
      <Section title="Forensic fingerprint"><Field label="SHA-256" value={fingerprint?.body_sha256} /><Field label="TLSH" value={fingerprint?.tlsh} /><Field label="IOC count" value={fingerprint?.ioc_count} /></Section>
    </> : <Section title="Unavailable"><p style={{ color: '#fca5a5' }}>This investigation is not available.</p></Section>}</div>
  </AppShell>;
}
