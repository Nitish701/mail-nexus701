import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralOrganizationReports, fetchCentralOrganizations } from '../../lib/api';

const navItems = [{ label: 'SOC Overview', href: '/' }, { label: 'Live Feed', href: '/live-feed' }, { label: 'Campaigns', href: '/campaigns' }, { label: 'Investigations', href: '/investigations' }, { label: 'Threat Intelligence', href: '/threat-intelligence' }, { label: 'Tenants', href: '/tenants' }, { label: 'Reports', href: '/reports' }, { label: 'System Health', href: '/system-health' }];

export default async function CentralTenantsPage({ searchParams }: { searchParams?: { organization?: string } }) {
  const organizations = await fetchCentralOrganizations();
  const selected = organizations.find((item) => String(item.id) === searchParams?.organization) || organizations[0];
  const reports = selected ? (await fetchCentralOrganizationReports(selected.id)).reports : [];

  return <AppShell title="Organizations" subtitle="Central organization view" navItems={navItems}>
    <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24 }}>
      <div style={{ marginBottom: 20 }}><h2 style={{ margin: 0, fontSize: 22 }}>Organization workspaces</h2><p style={{ color: '#9fb5d8', marginBottom: 0 }}>Live registered organizations and their isolated suspicious-report scopes.</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {organizations.map((organization) => <Link key={organization.id} href={`/tenants?organization=${organization.id}`} style={{ border: selected?.id === organization.id ? '1px solid #60a5fa' : '1px solid #243b5b', background: selected?.id === organization.id ? '#172554' : '#0b1221', padding: 18, color: '#e5f0ff' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><strong style={{ fontSize: 18 }}>{organization.name}</strong><span style={{ color: '#86efac', font: '800 10px Arial' }}>ACTIVE</span></div><div style={{ color: '#9fb5d8', marginTop: 8, fontSize: 13 }}>{organization.domains.join(' · ')}</div></Link>)}
      </div>
    </section>
    <section style={{ marginTop: 18, background: '#111827', border: '1px solid #243b5b', padding: 24 }}>
      <div style={{ marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 22 }}>{selected?.name || 'Organization'} reports</h2><p style={{ color: '#9fb5d8', margin: '6px 0 0' }}>Suspicious reports received for this registered organization.</p></div>
      {reports.length === 0 ? <div style={{ color: '#9fb5d8', padding: '18px 0' }}>No suspicious reports are currently available.</div> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ color: '#9fb5d8', textAlign: 'left' }}><th>Report</th><th>Title</th><th>Severity</th><th>Date</th></tr></thead><tbody>{reports.map((report) => <tr key={String(report.report_id)} style={{ borderTop: '1px solid #243b5b' }}><td style={{ padding: '13px 8px 13px 0' }}><Link href={`/reports/${encodeURIComponent(String(report.report_id))}`} style={{ color: '#8ec5ff' }}>{String(report.report_id)}</Link></td><td style={{ padding: 13 }}>{String(report.title || 'Suspicious email')}</td><td style={{ padding: 13, color: '#fca5a5' }}>{String(report.severity || 'review')}</td><td style={{ padding: 13 }}>{String(report.created_at || 'Unknown')}</td></tr>)}</tbody></table>}
    </section>
  </AppShell>;
}
