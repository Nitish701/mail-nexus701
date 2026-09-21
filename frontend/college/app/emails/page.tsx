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
      <section style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #dfeaf6' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Email security queue</h2>
        {reports.length === 0 ? (
          <div style={{ color: '#5a6f8a', padding: '24px 0 8px' }}>No email security events are currently available.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#5a6f8a', textAlign: 'left', borderBottom: '1px solid #edf2f8' }}>
                <th style={{ paddingBottom: 10 }}>Sender</th>
                <th style={{ paddingBottom: 10 }}>Subject</th>
                <th style={{ paddingBottom: 10 }}>Tenant</th>
                <th style={{ paddingBottom: 10 }}>Risk</th>
                <th style={{ paddingBottom: 10 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                return (
                <tr key={report.report_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 8px 12px 0' }}>Message available in report</td>
                  <td style={{ padding: '12px 8px 12px 0' }}>{report.title}</td>
                  <td style={{ padding: '12px 8px 12px 0' }}>Organization</td>
                  <td style={{ padding: '12px 8px 12px 0' }}>
                    <span style={{ color: report.severity === 'high' ? '#b91c1c' : report.severity === 'medium' ? '#d97706' : '#16a34a', fontWeight: 700 }}>{report.severity}</span>
                  </td>
                  <td style={{ padding: '12px 8px 12px 0' }}>Received</td>
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
