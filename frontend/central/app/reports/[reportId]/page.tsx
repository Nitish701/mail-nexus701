import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralReportDetails } from '../../../lib/api';

const navItems = [{ label: 'SOC Overview', href: '/' }, { label: 'Live Feed', href: '/live-feed' }, { label: 'Campaigns', href: '/campaigns' }, { label: 'Investigations', href: '/investigations' }, { label: 'Threat Intelligence', href: '/threat-intelligence' }, { label: 'Reports', href: '/reports' }];

function SafeBlock({ title, value }: { title: string; value: unknown }) {
  return <details open style={{ border: '1px solid #243b5b', padding: 16, background: '#0b1221' }}><summary style={{ cursor: 'pointer', color: '#8ec5ff', fontWeight: 700 }}>{title}</summary><pre style={{ margin: '12px 0 0', color: '#dbeafe', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: '12px/1.5 Consolas, monospace' }}>{JSON.stringify(value, null, 2)}</pre></details>;
}

export default async function CentralReportDetailPage({ params }: { params: { reportId: string } }) {
  const report = await fetchCentralReportDetails(params.reportId);
  const message = report?.message as Record<string, unknown> | undefined;
  const fingerprint = report?.fingerprint as Record<string, unknown> | undefined;
  const safeFingerprint = fingerprint ? { body_sha256: fingerprint.body_sha256, tlsh: fingerprint.tlsh, ioc_count: fingerprint.ioc_count } : null;
  return <AppShell title="Central investigation" subtitle="Privacy-limited detail" navItems={navItems}>
    <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24 }}><Link href="/reports" style={{ color: '#8ec5ff', fontWeight: 700 }}>Back to reports</Link>{report ? <><h2 style={{ margin: '18px 0 6px', fontSize: 22 }}>{String(report.title || params.reportId)}</h2><div style={{ color: '#9fb5d8', marginBottom: 18 }}>{params.reportId} · Suspicious email shared for central correlation</div><div style={{ display: 'grid', gap: 12 }}><SafeBlock title="Message metadata" value={{ from: message?.from, to: message?.to, subject: message?.subject, message_id: message?.message_id }} /><SafeBlock title="Risk and detection" value={{ risk: report.risk, findings: report.findings, layers: report.layers }} /><SafeBlock title="Threat indicators" value={{ urls: report.urls, iocs: report.iocs, attachments: report.attachments, virustotal: report.virustotal }} /><SafeBlock title="Authentication" value={report.authentication} /><SafeBlock title="Privacy-safe fingerprint" value={safeFingerprint} /></div></> : <div style={{ color: '#fca5a5', marginTop: 18 }}>This investigation is not available.</div>}</section>
  </AppShell>;
}
