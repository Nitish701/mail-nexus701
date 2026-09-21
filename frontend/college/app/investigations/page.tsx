import { AppShell } from '../../components/AppShell';
import { fetchCollegeReports } from '../../lib/api';

const navItems = [{ label: 'Dashboard', href: '/' }, { label: 'Emails', href: '/emails' }, { label: 'Threats', href: '/threats' }, { label: 'Campaigns', href: '/campaigns' }, { label: 'Reports', href: '/reports' }];

export default async function CollegeInvestigationsPage() {
  const reports = await fetchCollegeReports();
  const investigations = reports.filter((report) => ['high', 'critical'].includes(report.severity.toLowerCase()));
  return <AppShell title="Investigations" subtitle="Analyst queue" navItems={navItems}>
    <section className="data-section"><div className="section-heading"><div><h2>Open investigations</h2><div className="muted">High-risk reports requiring analyst attention.</div></div></div>
      {investigations.length === 0 ? <p className="muted">No active investigations are currently available.</p> : <table className="data-table"><thead><tr><th>Report</th><th>Threat</th><th>Created</th><th>Status</th></tr></thead><tbody>{investigations.map((report) => <tr key={report.report_id}><td>{report.report_id}</td><td>{report.title}</td><td>{report.created_at || 'Unknown'}</td><td><span className="badge badge-high">UNDER REVIEW</span></td></tr>)}</tbody></table>}
    </section>
  </AppShell>;
}
