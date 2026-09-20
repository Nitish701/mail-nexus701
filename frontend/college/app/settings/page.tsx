import { AppShell } from '../../components/AppShell';

const settings = [
  { label: 'Portal profile', value: 'Organization security' },
  { label: 'Gateway configuration', value: 'Pending backend sync' },
  { label: 'Connection status', value: 'Standby' },
  { label: 'Data residency', value: 'Organization-controlled' }
];

export default function CollegeSettingsPage() {
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
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Portal settings</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {settings.map((item) => (
            <div key={item.label} style={{ border: '1px solid #dfeaf6', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontWeight: 700 }}>{item.label}</div>
              <div style={{ color: '#3c6bb3', fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
