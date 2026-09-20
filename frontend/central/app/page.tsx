import { fetchCentralOverview } from '../lib/api';
import Link from 'next/link';

const navItems = [
  { label: 'SOC Overview', href: '/' },
  { label: 'Live Feed', href: '/live-feed' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Investigations', href: '/investigations' },
  { label: 'Threat Intelligence', href: '/threat-intelligence' },
  { label: 'Tenants', href: '/tenants' },
  { label: 'Reports', href: '/reports' },
  { label: 'System Health', href: '/system-health' }
];

export default async function CentralHome() {
  const overview = await fetchCentralOverview();

  const metrics = [
    { label: 'Backend status', value: overview.apiStatus },
    { label: 'Active campaigns', value: String(overview.campaignCount) },
    { label: 'Central reports', value: String(overview.reportCount) },
    { label: 'Affected tenants', value: '0' }
  ];

  return (
    <main style={{ fontFamily: 'Arial, sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e5f0ff', padding: '32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#8ec5ff', fontWeight: 700 }}>Mail-Nexus</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 32 }}>Central Security & Correlation SOC</h1>
          </div>
          <div style={{ background: '#1d4ed8', color: '#eff6ff', borderRadius: 999, padding: '10px 18px', fontWeight: 700 }}>Cross-tenant view</div>
        </header>

        <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 30 }}>
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} style={{ background: '#111827', border: '1px solid #243b5b', borderRadius: 10, padding: '10px 16px', fontWeight: 600, color: '#e5f0ff', textDecoration: 'none' }}>{item.label}</Link>
          ))}
        </nav>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 30 }}>
          {metrics.map((metric) => (
            <div key={metric.label} style={{ background: '#111827', borderRadius: 14, padding: 20, border: '1px solid #243b5b' }}>
              <div style={{ color: '#a5c3ff', fontSize: 13, marginBottom: 10 }}>{metric.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, wordBreak: 'break-word' }}>{metric.value}</div>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 20, marginBottom: 20 }}>
          <div style={{ background: '#111827', borderRadius: 16, padding: 24, border: '1px solid #243b5b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>Live threat feed</h2>
              <span style={{ color: '#8ec5ff', fontWeight: 700 }}>Federated intelligence</span>
            </div>
            <div style={{ color: '#9fb5d8', padding: '28px 12px 8px' }}>No live threat events are currently available.</div>
          </div>

          <div style={{ background: '#13213f', borderRadius: 16, padding: 24, border: '1px solid #2d4b74' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>IOC summary</h2>
            <div style={{ color: '#9fb5d8', padding: '16px 0 8px' }}>No indicator data is currently available.</div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#111827', borderRadius: 16, padding: 24, border: '1px solid #243b5b' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Tenant monitoring</h2>
            <div style={{ color: '#9fb5d8', padding: '16px 0 8px' }}>No organization tenants are currently connected.</div>
          </div>

          <div style={{ background: '#111827', borderRadius: 16, padding: 24, border: '1px solid #243b5b' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Central SOC posture</h2>
            <p style={{ margin: '0 0 12px', color: '#bfd4f9', lineHeight: 1.7 }}>
              This deployment is designed for campaign correlation, cross-organization intelligence, and centralized monitoring. Live data appears here after connected organization scans are received.
            </p>
            <div style={{ background: '#172554', borderRadius: 12, padding: 16, border: '1px solid #1d4ed8', color: '#dbeafe', fontWeight: 700 }}>
              Authorized boundary: federated threat intelligence and relationship analysis across connected organizations
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
