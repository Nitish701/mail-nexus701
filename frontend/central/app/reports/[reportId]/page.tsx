import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralReportDetails } from '../../../lib/api';

const navItems = [{ label: 'SOC Overview', href: '/' }, { label: 'Live Feed', href: '/live-feed' }, { label: 'Campaigns', href: '/campaigns' }, { label: 'Investigations', href: '/investigations' }, { label: 'Threat Intelligence', href: '/threat-intelligence' }, { label: 'Reports', href: '/reports' }];

function Field({ label, value }: { label: string; value: unknown }) { return <div style={{ borderTop: '1px solid #243b5b', padding: '12px 0' }}><div style={{ color: '#91a9c7', font: '11px Arial', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div><div style={{ marginTop: 5, color: '#e5f0ff', overflowWrap: 'anywhere' }}>{value == null || value === '' ? 'Not available' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</div></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 20 }}><h3 style={{ margin: '0 0 14px', color: '#8ec5ff', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</h3>{children}</section>; }

export default async function CentralReportDetailPage({ params }: { params: { reportId: string } }) {
  const report = await fetchCentralReportDetails(params.reportId);
  const message = report?.message as Record<string, unknown> | undefined;
  const risk = report?.risk as Record<string, unknown> | undefined;
  const geo = report?.geolocation as Record<string, unknown> | undefined;
  const fingerprint = report?.fingerprint as Record<string, unknown> | undefined;
  return <AppShell title="Central investigation report" subtitle="Formal investigation" navItems={navItems}>
    <div style={{ display: 'grid', gap: 16 }}><Link href="/reports" style={{ color: '#8ec5ff', fontWeight: 700 }}>Back to reports</Link>{report ? <>
      <header style={{ background: '#172554', border: '1px solid #36558a', padding: 24 }}><div style={{ color: '#9fb5d8', font: '11px Arial', textTransform: 'uppercase', letterSpacing: 1.4 }}>Mail Nexus · Central SOC</div><h2 style={{ margin: '10px 0 8px', fontSize: 28 }}>{String(report.title || params.reportId)}</h2><div style={{ color: '#bfd4f9' }}>{params.reportId} · Suspicious activity shared for central correlation</div></header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}><div className="central-report-stat"><small>Status</small><strong>UNDER REVIEW</strong></div><div className="central-report-stat"><small>Severity</small><strong>{String(report.severity || 'Unknown')}</strong></div><div className="central-report-stat"><small>Risk score</small><strong>{String(risk?.base_score ?? 'N/A')} / 70</strong></div><div className="central-report-stat"><small>Source</small><strong>Organization {String(report.organization_id || 'scoped')}</strong></div></div>
      <Section title="Executive summary"><p style={{ margin: 0, color: '#dbeafe', lineHeight: 1.7 }}>{String((report.advisory as Record<string, unknown> | undefined)?.summary || 'Investigation evidence is available below.')}</p></Section>
      <Section title="Email intelligence"><Field label="Message ID" value={message?.message_id} /><Field label="Sender" value={message?.from} /><Field label="Recipient" value={Array.isArray(message?.to) ? message?.to.join(', ') : message?.to} /><Field label="Subject" value={message?.subject} /></Section>
      <Section title="Threat intelligence"><Field label="Findings" value={report.findings} /><Field label="URLs" value={report.urls} /><Field label="IOCs" value={report.iocs} /><Field label="Attachments" value={report.attachments} /><Field label="VirusTotal" value={report.virustotal} /></Section>
      <Section title="Authentication and detection"><Field label="Authentication" value={report.authentication} /><Field label="Detection layers" value={report.layers} /></Section>
      <Section title="Geolocation assessment"><Field label="Source IP" value={geo?.source_ip} /><Field label="Country / region / city" value={[geo?.country, geo?.region, geo?.city].filter(Boolean).join(' / ')} /><Field label="ASN" value={geo?.asn} /><Field label="VPN / proxy" value={geo?.is_vpn_proxy} /><Field label="Confidence" value={geo?.confidence != null ? `${Math.round(Number(geo.confidence) * 100)}%` : null} /></Section>
      <Section title="Forensic fingerprint"><Field label="SHA-256" value={fingerprint?.body_sha256} /><Field label="TLSH" value={fingerprint?.tlsh} /><Field label="IOC count" value={fingerprint?.ioc_count} /></Section>
    </> : <Section title="Unavailable"><p style={{ color: '#fca5a5' }}>This investigation is not available.</p></Section>}</div>
  </AppShell>;
}
