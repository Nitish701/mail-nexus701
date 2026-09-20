import { fetchCollegeOverview } from '../lib/api';
import { DemoScanButton } from '../components/DemoScanButton';
import Link from 'next/link';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Emails', href: '/emails' },
  { label: 'Threats', href: '/threats' },
  { label: 'Investigations', href: '/investigations' },
  { label: 'Reports', href: '/reports' },
  { label: 'Settings', href: '/settings' }
];

export default async function CollegeHome() {
  const overview = await fetchCollegeOverview();

  const metrics = [
    { label: 'Backend status', value: overview.apiStatus },
    { label: 'Security reports', value: String(overview.reportCount) },
    { label: 'Open incidents', value: '0' },
    { label: 'Threat score', value: '—' }
  ];

  const recentActivity: Array<{ source: string; summary: string; risk: string; status: string }> = [];

  const evidenceItems = [
    { label: 'Email security posture', value: overview.apiStatus === 'online' ? 'Healthy' : 'Monitoring offline' },
    { label: 'Primary queue', value: 'Awaiting backend sync' },
    { label: 'Data source', value: 'Mail-Nexus sensors' },
    { label: 'Current focus', value: 'Organization-wide visibility' }
  ];

  return (
    <main style={{ fontFamily: 'Arial, sans-serif', background: '#f3f7fb', minHeight: '100vh', color: '#10233d', padding: '32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#3c6bb3', fontWeight: 700 }}>Mail-Nexus</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 32 }}>Organization Security Portal</h1>
          </div>
          <div style={{ background: '#dfeafc', color: '#183b68', borderRadius: 999, padding: '10px 18px', fontWeight: 700 }}>Organization security</div>
        </header>

        <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 30 }}>
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} style={{ background: '#ffffff', border: '1px solid #dfeaf6', borderRadius: 10, padding: '10px 16px', fontWeight: 600, color: '#10233d', textDecoration: 'none' }}>{item.label}</Link>
          ))}
        </nav>

        <DemoScanButton />

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 30 }}>
          {metrics.map((metric) => (
            <div key={metric.label} style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #dfeaf6', boxShadow: '0 8px 16px rgba(16,35,61,0.04)' }}>
              <div style={{ color: '#5a6f8a', fontSize: 13, marginBottom: 10 }}>{metric.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, wordBreak: 'break-word' }}>{metric.value}</div>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 20, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #dfeaf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>Recent security activity</h2>
              <span style={{ color: '#3c6bb3', fontWeight: 700 }}>Organization view</span>
            </div>
            {recentActivity.length === 0 ? (
              <div style={{ padding: '28px 12px 8px', color: '#5a6f8a' }}>
                No recent security events are currently available.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#5a6f8a', textAlign: 'left', borderBottom: '1px solid #edf2f8' }}>
                    <th style={{ paddingBottom: 10 }}>Source</th>
                    <th style={{ paddingBottom: 10 }}>Summary</th>
                    <th style={{ paddingBottom: 10 }}>Risk</th>
                    <th style={{ paddingBottom: 10 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((item) => (
                    <tr key={item.source} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 8px 12px 0' }}>{item.source}</td>
                      <td style={{ padding: '12px 8px 12px 0' }}>{item.summary}</td>
                      <td style={{ padding: '12px 8px 12px 0' }}>
                        <span style={{ color: item.risk === 'Critical' ? '#b91c1c' : item.risk === 'High' ? '#d97706' : item.risk === 'Medium' ? '#2563eb' : '#16a34a', fontWeight: 700 }}>{item.risk}</span>
                      </td>
                      <td style={{ padding: '12px 8px 12px 0' }}>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ background: '#edf4ff', borderRadius: 16, padding: 24, border: '1px solid #d8e6ff' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Evidence snapshot</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {evidenceItems.map((item) => (
                <div key={item.label} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #dfeaf6' }}>
                  <div style={{ color: '#5a6f8a', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1 }}>{item.label}</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #dfeaf6' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Threat categories</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {['Email phishing', 'Malicious links', 'Suspicious attachments', 'Business fraud'].map((item, index) => (
                <div key={item}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>{item}</span>
                    <span>{[0, 0, 0, 0][index]}%</span>
                  </div>
                  <div style={{ height: 8, background: '#edf2f8', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${[0, 0, 0, 0][index]}%`, height: '100%', background: '#3c6bb3', borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #dfeaf6' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Security posture</h2>
            <p style={{ margin: '0 0 12px', color: '#455b78', lineHeight: 1.7 }}>
              This organization security environment is designed for centralized monitoring, evidence handling, and daily threat visibility across mail and security operations.
            </p>
            <div style={{ background: '#f0f9ff', borderRadius: 12, padding: 16, border: '1px solid #d8ebff', color: '#0c4a6e', fontWeight: 700 }}>
              Ready for organization-wide detection, investigation, and reporting workflows.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
