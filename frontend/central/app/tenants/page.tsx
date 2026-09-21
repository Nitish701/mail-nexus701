import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralOrganizationReports } from '../../lib/api';

const navItems = [
  { label: 'SOC Overview', href: '/' },
  { label: 'Live Feed', href: '/live-feed' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Investigations', href: '/investigations' },
  { label: 'Threat Intelligence', href: '/threat-intelligence' },
  { label: 'Tenants', href: '/tenants' },
  { label: 'Reports', href: '/reports' },
  { label: 'System Health', href: '/system-health' }
];

type OrganizationCard = { id: string; name: string; domain: string; kind: 'REAL' | 'DEMO'; organizationId?: number };

const organizations: OrganizationCard[] = [
  { id: 'edushield', name: 'EduShield1.in', domain: 'edushield1.in', kind: 'REAL', organizationId: 1 },
  { id: 'organization-a', name: 'Organization A', domain: 'Demo organization', kind: 'DEMO' },
  { id: 'organization-b', name: 'Organization B', domain: 'Demo organization', kind: 'DEMO' }
];

export default async function CentralTenantsPage({ searchParams }: { searchParams?: { organization?: string } }) {
  const selected = organizations.find((item) => item.id === searchParams?.organization) || organizations[0];
  const reports = selected.organizationId ? (await fetchCentralOrganizationReports(selected.organizationId)).reports : [];

  return <AppShell title="Organizations" subtitle="Central organization view" navItems={navItems}>
    <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24 }}>
      <div style={{ marginBottom: 20 }}><h2 style={{ margin: 0, fontSize: 22 }}>Organization workspaces</h2><p style={{ color: '#9fb5d8', marginBottom: 0 }}>EduShield1.in is connected to real Cloudflare-ingested data. Other workspaces are reserved for future demonstration data.</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {organizations.map((organization) => <Link key={organization.id} href={`/tenants?organization=${organization.id}`} style={{ border: organization.id === selected.id ? '1px solid #60a5fa' : '1px solid #243b5b', background: organization.id === selected.id ? '#172554' : '#0b1221', padding: 18, color: '#e5f0ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><strong style={{ fontSize: 18 }}>{organization.name}</strong><span style={{ color: organization.kind === 'REAL' ? '#86efac' : '#facc15', font: '800 10px Arial' }}>{organization.kind}</span></div>
          <div style={{ color: '#9fb5d8', marginTop: 8, fontSize: 13 }}>{organization.domain}</div>
        </Link>)}
      </div>
    </section>

    <section style={{ marginTop: 18, background: '#111827', border: '1px solid #243b5b', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}><div><h2 style={{ margin: 0, fontSize: 22 }}>{selected.name} reports</h2><p style={{ color: '#9fb5d8', margin: '6px 0 0' }}>{selected.kind === 'REAL' ? 'Real suspicious reports received for this organization.' : 'No demo email data has been added yet.'}</p></div><span style={{ color: selected.kind === 'REAL' ? '#86efac' : '#facc15', fontWeight: 800 }}>{selected.kind}</span></div>
      {reports.length === 0 ? <div style={{ color: '#9fb5d8', padding: '18px 0' }}>{selected.kind === 'REAL' ? 'No suspicious reports are currently available.' : 'Organization is present. Reports will appear after demo data is provided.'}</div> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ color: '#9fb5d8', textAlign: 'left' }}><th>Report</th><th>Title</th><th>Severity</th><th>Date</th></tr></thead><tbody>{reports.map((report) => <tr key={String(report.report_id)} style={{ borderTop: '1px solid #243b5b' }}><td style={{ padding: '13px 8px 13px 0' }}><Link href={`/reports/${encodeURIComponent(String(report.report_id))}`} style={{ color: '#8ec5ff' }}>{String(report.report_id)}</Link></td><td style={{ padding: 13 }}>{String(report.title || 'Suspicious email')}</td><td style={{ padding: 13, color: '#fca5a5' }}>{String(report.severity || 'review')}</td><td style={{ padding: 13 }}>{String(report.created_at || 'Unknown')}</td></tr>)}</tbody></table>}
    </section>
  </AppShell>;
}
