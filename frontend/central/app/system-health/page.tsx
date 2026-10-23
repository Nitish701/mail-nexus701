import { AppShell } from '../../components/AppShell';
import { StatCard } from '../../components/StatCard';
import { fetchCentralCampaigns, fetchCentralHealth, fetchCentralOrganizations, fetchCentralAllReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

export default async function CentralSystemHealthPage() {
  const [health, campaigns, organizations, reportResponse] = await Promise.all([
    fetchCentralHealth(),
    fetchCentralCampaigns(),
    fetchCentralOrganizations(),
    fetchCentralAllReports()
  ]);
  const apiAvailable = health.status === 'ok' || health.status === 'online';
  const reports = reportResponse.reports;

  return (
    <AppShell
      title="System health"
      subtitle="Backend endpoint and persisted-record checks"
      navItems={[...CENTRAL_NAV]}
    >
      <header className="page-intro">
        <div>
          <h1>Service checks</h1>
          <p>Responses from the configured API and its database-backed record endpoints.</p>
        </div>
      </header>

      <section className="stat-grid" aria-label="Backend endpoint checks">
        <StatCard
          label="Developer API"
          value={apiAvailable ? 'Available' : health.status}
          tone={apiAvailable ? 'ok' : 'critical'}
          hint="Health endpoint response"
        />
        <StatCard
          label="Registered organizations"
          value={organizations.length}
          hint="Organizations endpoint rows"
        />
        <StatCard
          label="Campaign records"
          value={campaigns.length}
          hint="Campaign endpoint rows"
        />
        <StatCard
          label="Email reports returned"
          value={reports.length}
          hint="Current API response; list is paginated"
        />
      </section>

      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Integration status</h2>
            <span className="section-desc">Only checks exposed by the application are reported here.</span>
          </div>
        </div>
        <dl className="service-facts">
          <div>
            <dt>API health</dt>
            <dd>{String(health.status)}</dd>
          </div>
          <div>
            <dt>Health service label</dt>
            <dd>{health.service || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Mailbox provider</dt>
            <dd>Not reported by the backend</dd>
          </div>
          <div>
            <dt>Email forwarding</dt>
            <dd>Operational status is not exposed by the backend</dd>
          </div>
          <div>
            <dt>WebSocket clients</dt>
            <dd>Connected-client status is not exposed by the backend</dd>
          </div>
        </dl>
      </section>
    </AppShell>
  );
}
