import { AppShell } from '../../components/AppShell';
import { fetchCentralHealth, fetchCentralOverview, getApiBaseUrl } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

export default async function SystemHealthPage() {
  const [health, overview] = await Promise.all([
    fetchCentralHealth(),
    fetchCentralOverview()
  ]);

  const status = String(health.status || overview.apiStatus || 'offline').toLowerCase();
  const isUp = status === 'ok' || status === 'healthy' || status === 'online';

  return (
    <AppShell
      title="System health"
      subtitle="Central correlation service status"
      navItems={[...CENTRAL_NAV]}
    >
      <section className="report-stat-grid" style={{ marginBottom: 28 }}>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">API status</div>
            <strong style={{ fontSize: 22, color: isUp ? '#76e6aa' : '#fca5a5' }}>
              {isUp ? 'ONLINE' : status.toUpperCase()}
            </strong>
          </div>
        </div>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Service</div>
            <strong style={{ fontSize: 16 }}>
              {String(health.service || 'developer2 / correlation')}
            </strong>
          </div>
        </div>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Campaigns</div>
            <strong style={{ fontSize: 22 }}>{overview.campaignCount}</strong>
          </div>
        </div>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Suspicious reports</div>
            <strong style={{ fontSize: 22 }}>{overview.suspiciousCount}</strong>
          </div>
        </div>
      </section>

      <section
        style={{
          background: '#0f1a28',
          border: '1px solid #243b5b',
          borderRadius: 12,
          padding: 24
        }}
      >
        <div className="soc-kicker" style={{ marginBottom: 12 }}>
          Endpoint configuration
        </div>
        <div className="report-field" style={{ marginBottom: 12 }}>
          <span>API base URL</span>
          <strong style={{ fontFamily: 'Consolas, monospace' }}>{getApiBaseUrl()}</strong>
        </div>
        <div className="report-field" style={{ marginBottom: 12 }}>
          <span>Health path</span>
          <strong style={{ fontFamily: 'Consolas, monospace' }}>/api/developer2/health</strong>
        </div>
        <div className="report-field" style={{ marginBottom: 12 }}>
          <span>Live feed WebSocket</span>
          <strong style={{ fontFamily: 'Consolas, monospace' }}>
            /api/developer2/ws/live-feed
          </strong>
        </div>
        <div className="report-field">
          <span>Environment</span>
          <strong>Central SOC (cross-tenant)</strong>
        </div>
      </section>
    </AppShell>
  );
}
