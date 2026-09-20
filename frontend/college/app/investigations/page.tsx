import { AppShell } from '../../components/AppShell';

const investigations: { name: string; owner: string; progress: string; state: string }[] = [];

export default function CollegeInvestigationsPage() {
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
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Investigation queue</h2>
        {investigations.length === 0 ? (
          <div style={{ color: '#5a6f8a', padding: '24px 0 8px' }}>No active investigations are currently available.</div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {investigations.map((caseItem) => (
              <div key={caseItem.name} style={{ border: '1px solid #dfeaf6', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{caseItem.name}</div>
                    <div style={{ color: '#5a6f8a', marginTop: 4 }}>{caseItem.owner}</div>
                  </div>
                  <div style={{ color: '#3c6bb3', fontWeight: 700 }}>{caseItem.state}</div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>Progress</span>
                    <span>{caseItem.progress}</span>
                  </div>
                  <div style={{ height: 8, background: '#edf2f8', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: caseItem.progress, height: '100%', background: '#3c6bb3', borderRadius: 999 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
