import { AppShell } from '../../components/AppShell';

const emails: { sender: string; subject: string; risk: string; tenant: string; status: string }[] = [];

export default function CollegeEmailsPage() {
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
        {emails.length === 0 ? (
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
              {emails.map((email) => (
                <tr key={email.sender} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 8px 12px 0' }}>{email.sender}</td>
                  <td style={{ padding: '12px 8px 12px 0' }}>{email.subject}</td>
                  <td style={{ padding: '12px 8px 12px 0' }}>{email.tenant}</td>
                  <td style={{ padding: '12px 8px 12px 0' }}>
                    <span style={{ color: email.risk === 'Critical' ? '#b91c1c' : email.risk === 'High' ? '#d97706' : email.risk === 'Medium' ? '#2563eb' : '#16a34a', fontWeight: 700 }}>{email.risk}</span>
                  </td>
                  <td style={{ padding: '12px 8px 12px 0' }}>{email.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
