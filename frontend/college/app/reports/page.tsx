import { AppShell } from '../../components/AppShell';
import { fetchCollegeReports } from '../../lib/api';
import { ReportAccordion } from '../../components/ReportAccordion';

const navItems = [{ label: 'Dashboard', href: '/' }, { label: 'Emails', href: '/emails' }, { label: 'Threats', href: '/threats' }, { label: 'Campaigns', href: '/campaigns' }, { label: 'Reports', href: '/reports' }];

export default async function CollegeReportsPage() {
  const reports = await fetchCollegeReports();
  return <AppShell title="Investigation reports" subtitle="Structured intelligence" navItems={navItems}>
    <section className="data-section">
      <div className="section-heading"><div><h2>College reports</h2><div className="muted">Open a report to review the evidence collected by the live pipeline.</div></div></div>
      {reports.length === 0 ? <p className="muted">No reports are available for this college.</p> : <ReportAccordion reports={reports} />}
    </section>
  </AppShell>;
}
