import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCollegeReports } from '../../lib/api';
import { ReportAccordion } from '../../components/ReportAccordion';

export default async function CollegeReportsPage() {
  const reports = await fetchCollegeReports();

  return (
    <AppShell title="Forensic Reports" subtitle="Structured email scan dossiers">
      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Institutional Investigation Reports ({reports.length})</h2>
            <span className="section-desc">Click any report to expand findings, forensic advisory, and authentication signals.</span>
          </div>
          <Link href="/" className="btn btn-ghost btn-sm">
            ← Back to dashboard
          </Link>
        </div>

        {reports.length === 0 ? (
          <div className="empty-state">No investigation reports are currently logged for this college.</div>
        ) : (
          <ReportAccordion reports={reports} />
        )}
      </section>
    </AppShell>
  );
}
