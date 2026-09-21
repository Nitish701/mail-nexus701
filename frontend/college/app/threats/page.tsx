import { AppShell } from '../../components/AppShell';
import { fetchCollegeReportDetails, fetchCollegeReports } from '../../lib/api';

const navItems = [{ label: 'Dashboard', href: '/' }, { label: 'Emails', href: '/emails' }, { label: 'Threats', href: '/threats' }, { label: 'Campaigns', href: '/campaigns' }, { label: 'Reports', href: '/reports' }];

export default async function CollegeThreatsPage() {
  const reports = await fetchCollegeReports();
  const details = await Promise.all(reports.map((report) => fetchCollegeReportDetails(report.report_id)));
  const threats = details.flatMap((detail, index) => (detail?.findings as string[] | undefined || []).map((finding) => ({ finding, report: reports[index] })));
  return <AppShell title="Threat intelligence" subtitle="Detection signals" navItems={navItems}>
    <section className="data-section"><div className="section-heading"><div><h2>Observed threat signals</h2><div className="muted">Signals are derived from received email analysis. No placeholder threats are shown.</div></div></div>
      {threats.length === 0 ? <p className="muted">No suspicious indicators detected.</p> : <table className="data-table"><thead><tr><th>Signal</th><th>Report</th><th>Risk</th><th>Status</th></tr></thead><tbody>{threats.map((item, index) => <tr key={`${item.report.report_id}-${index}`}><td>{item.finding}</td><td>{item.report.report_id}</td><td><span className={`badge badge-${item.report.severity.toLowerCase()}`}>{item.report.severity}</span></td><td>UNDER REVIEW</td></tr>)}</tbody></table>}
    </section>
  </AppShell>;
}
