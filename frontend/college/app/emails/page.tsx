import { AppShell } from '../../components/AppShell';
import { fetchCollegeReports } from '../../lib/api';

export default async function CollegeEmailsPage() {
  const reports = await fetchCollegeReports();

  return (
    <AppShell
      title="Organization Security Portal"
      subtitle="Organization security"
      navItems={[
        { label: 'Dashboard', href: '/' },
        { label: 'Emails', href: '/emails' },
        { label: 'Threats', href: '/threats' },
        { label: 'Investigations', href: '/investigations' },
        { label: 'Reports', href: '/reports' },
        { label: 'Settings', href: '/settings' }
      ]}
    >
      <section className="data-section">
        <div className="section-heading"><div><h2>Email security queue</h2><div className="muted">Messages captured and analyzed by the live Mail Nexus ingestion pipeline.</div></div></div>
        {reports.length === 0 ? (
          <div style={{ color: '#5a6f8a', padding: '24px 0 8px' }}>No email security events are currently available.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sender</th><th>Subject</th><th>Tenant</th><th>Risk</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                return (
                <tr key={report.report_id}>
                  <td>Message available in report</td><td>{report.title}</td><td>Organization</td><td><span className={`badge badge-${report.severity.toLowerCase()}`}>{report.severity}</span></td><td>ANALYZED</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
