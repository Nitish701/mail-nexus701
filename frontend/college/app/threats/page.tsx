import { AppShell } from '../../components/AppShell';

const threats: { type: string; score: string; evidence: string; status: string }[] = [];

export default function CollegeThreatsPage() {
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
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Threat overview</h2>
        {threats.length === 0 ? (
          <div style={{ color: '#5a6f8a', padding: '24px 0 8px' }}>No active threat signals are currently available.</div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {threats.map((threat) => (
              <div key={threat.type} style={{ border: '1px solid #dfeaf6', borderRadius: 12, padding: 16, background: '#f8fbff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{threat.type}</div>
                    <div style={{ color: '#5a6f8a', marginTop: 4 }}>{threat.evidence}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#3c6bb3' }}>{threat.score}/100</div>
                </div>
                <div style={{ marginTop: 12, color: '#244b7a', fontWeight: 700 }}>{threat.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
