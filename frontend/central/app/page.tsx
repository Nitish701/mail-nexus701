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
      <div className="central-dashboard">
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
        <div className="central-hero-signal" aria-label="Illustrative recent activity sparkline">
          <span>Recent signal</span>
          <div aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <small>Illustrative only · TODO: connect time-series data</small>
        </div>
      </section>

      <section className="central-telemetry-grid" aria-label="Threat activity overview">
        <article className="central-glass-panel central-activity-panel">
          <div className="central-panel-heading">
            <div><span>Threat activity</span><h2>Signals over time</h2></div>
            <span className="central-placeholder-tag">Preview</span>
          </div>
          <div className="central-chart-wrap">
            <svg viewBox="0 0 620 150" role="img" aria-label="Illustrative threat activity chart placeholder">
              <defs><linearGradient id="dashboard-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4c8dff" stopOpacity=".3" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient></defs>
              <path className="central-chart-area" d="M0 121 C35 116 40 92 76 99 S126 123 160 94 S213 71 247 87 S293 53 328 68 S375 88 409 52 S462 74 494 45 S548 63 580 29 S604 38 620 18 V150 H0Z" />
              <path className="central-chart-line" d="M0 121 C35 116 40 92 76 99 S126 123 160 94 S213 71 247 87 S293 53 328 68 S375 88 409 52 S462 74 494 45 S548 63 580 29 S604 38 620 18" />
              <path className="central-chart-grid" d="M0 35H620 M0 75H620 M0 115H620" />
            </svg>
            <div className="central-chart-labels"><span>Earlier</span><span>Now</span></div>
          </div>
          <p className="central-placeholder-note">Illustrative activity profile · TODO: connect real time-series data</p>
        </article>

        <article className="central-glass-panel central-org-panel">
          <div className="central-panel-heading">
            <div><span>Organization exposure</span><h2>Cross-tenant reach</h2></div>
            <span className="central-data-tag">Current</span>
          </div>
          <div className="central-org-total"><strong>{organizationCount}</strong><span>organizations touched</span></div>
          <div className="central-heat-grid" aria-hidden="true">
            {Array.from({ length: 24 }, (_, index) => <i key={index} className={index < Math.min(organizationCount, 8) ? 'is-lit' : ''} />)}
          </div>
          <p className="central-placeholder-note">Each lit cell represents an organization; individual risk levels are not available here yet.</p>
        </article>

        <article className="central-glass-panel central-indicator-panel">
          <div className="central-panel-heading">
            <div><span>Attack patterns</span><h2>Top signals</h2></div>
            <span className="central-placeholder-tag">Preview</span>
          </div>
          <div className="central-ranking-row"><span>Top attack types</span><strong>Not ranked yet</strong></div>
          <div className="central-ranking-row"><span>Sender domains</span><strong>Not ranked yet</strong></div>
          <p className="central-placeholder-note">TODO: connect ranked attack and domain intelligence data</p>
        </article>
      </section>

      <aside className="central-privacy-note"><span aria-hidden="true">◇</span><p><strong>Privacy boundary</strong> The central view shows cross-tenant security signals only. Tenant-local message content is never exposed.</p></aside>

      <section className="page-toolbar">
        <div>
          <div className="soc-kicker">Priority queue · cross-tenant</div>
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
                  <span className="campaign-status"><i aria-hidden="true" />ACTIVE</span>
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
                    <span>Organizations reached</span>
                  </div>
                  <div>
                    <strong>{Number(campaign.email_count || members.length)}</strong>
                    <span>Related messages</span>
                  </div>
                  <div>
                    <strong>{similarity}%</strong>
                    <span>Pattern similarity</span>
                  </div>
                </div>
                <div className="central-campaign-foot"><span>Open campaign evidence</span><span aria-hidden="true">↗</span></div>
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
      </div>
    </AppShell>
  );
}