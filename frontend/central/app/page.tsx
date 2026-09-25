import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { fetchCentralCampaigns, fetchCentralReports } from '../lib/api';
import { CENTRAL_NAV } from '../lib/nav';

export default async function CentralHome() {
  const [reports, campaigns] = await Promise.all([
    fetchCentralReports(),
    fetchCentralCampaigns()
  ]);

  const reportList = Array.isArray(reports.reports) ? reports.reports : [];
  const highRiskReports = reportList.filter((r) =>
    ['high', 'critical'].includes(String(r.severity || '').toLowerCase())
  );
  const criticalCount = reportList.filter(
    (r) => String(r.severity || '').toLowerCase() === 'critical'
  ).length;
  const organizationCount = new Set(
    campaigns.flatMap((c) =>
      Array.isArray(c.members)
        ? c.members.map((m) => String((m as Record<string, unknown>).tenant_id))
        : []
    )
  ).size;
  const latestCampaigns = campaigns.slice(0, 3);
  const domains = new Set<string>();
  const sourceIps = new Set<string>();
  campaigns.forEach((campaign) => {
    (Array.isArray(campaign.members) ? campaign.members : []).forEach((member) => {
      const item = member as Record<string, unknown>;
      if (item.sender_domain) domains.add(String(item.sender_domain));
      if (item.source_ip) sourceIps.add(String(item.source_ip));
    });
  });

  return (
    <AppShell
      title="Email Threat Intelligence Center"
      subtitle="Detect · Correlate · Investigate across all connected tenants"
      navItems={[...CENTRAL_NAV]}
    >
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="soc-kicker">Central Security Operations</div>
          <h2 className="hero-title">
            Cross-tenant phishing
            <br />
            <span>correlation & response</span>
          </h2>
          <p className="hero-desc">
            Monitor correlated campaigns, live fingerprint events, and high-severity indicators
            from every connected organization — without exposing college-local message content.
          </p>
          <div className="hero-actions">
            <Link href="/campaigns" className="btn-primary">
              Campaign center
            </Link>
            <Link href="/investigations" className="btn-secondary">
              Investigation queue
            </Link>
            <Link href="/live-feed" className="btn-ghost">
              Live feed
            </Link>
          </div>
        </div>
        <div className="stat-grid">
          <StatCard label="Critical threats" value={criticalCount} tone="critical" />
          <StatCard label="High-risk reports" value={highRiskReports.length} tone="high" />
          <StatCard label="Active campaigns" value={campaigns.length} tone="default" />
          <StatCard label="Organizations touched" value={organizationCount} tone="ok" />
        </div>
      </section>

      <section className="page-toolbar">
        <div>
          <div className="soc-kicker">Priority queue</div>
          <h2 className="page-section-title">Active campaigns</h2>
        </div>
        <Link href="/campaigns" className="btn-ghost">
          View all · list & graph →
        </Link>
      </section>

      <section className="campaign-list">
        {latestCampaigns.length === 0 ? (
          <div className="art-empty-state">
            No correlated campaigns yet. Fingerprints will appear once tenants report suspicious
            mail.
          </div>
        ) : (
          latestCampaigns.map((campaign) => {
            const members = Array.isArray(campaign.members)
              ? (campaign.members as Array<Record<string, unknown>>)
              : [];
            const campaignId = String(campaign.campaign_id || 'Unknown');
            const similarity = members.length
              ? Math.round(
                  (members.reduce((t, m) => t + Number(m.similarity || 0), 0) / members.length) *
                    100
                )
              : 0;
            return (
              <Link
                key={campaignId}
                href={`/campaigns/${encodeURIComponent(campaignId)}`}
                className="campaign-list-card"
              >
                <div className="campaign-list-head">
                  <div>
                    <div className="campaign-list-kicker">CORRELATED CAMPAIGN</div>
                    <div className="campaign-list-id">{campaignId}</div>
                  </div>
                  <span className="campaign-status">ACTIVE</span>
                </div>
                <div className="campaign-list-summary">
                  {String(
                    campaign.summary ||
                      `${members.length} related email fingerprints correlated across connected organizations.`
                  )}
                </div>
                <div className="campaign-list-stats">
                  <div>
                    <strong>{Number(campaign.tenant_count || 0)}</strong>
                    <span>Organizations</span>
                  </div>
                  <div>
                    <strong>{Number(campaign.email_count || members.length)}</strong>
                    <span>Fingerprints</span>
                  </div>
                  <div>
                    <strong>{similarity}%</strong>
                    <span>Match</span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </section>

      <section className="page-toolbar" style={{ marginTop: 36 }}>
        <div>
          <div className="soc-kicker">Threat surface</div>
          <h2 className="page-section-title">Indicator snapshot</h2>
        </div>
        <Link href="/threat-intelligence" className="btn-ghost">
          Full intelligence →
        </Link>
      </section>

      <div className="intel-strip">
        <div className="intel-tile">
          <span>Malicious domains</span>
          <strong>{domains.size}</strong>
        </div>
        <div className="intel-tile">
          <span>Source IPs</span>
          <strong>{sourceIps.size}</strong>
        </div>
        <div className="intel-tile">
          <span>Correlated fingerprints</span>
          <strong>
            {latestCampaigns.reduce((t, c) => t + Number(c.email_count || 0), 0)}
          </strong>
        </div>
        <div className="intel-tile">
          <span>Suspicious reports</span>
          <strong>{reportList.length}</strong>
        </div>
      </div>
    </AppShell>
  );
}