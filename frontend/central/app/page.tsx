import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { fetchCentralCampaigns, fetchCentralReports } from '../lib/api';
import { CENTRAL_NAV } from '../lib/nav';

function computeTelemetrySeries(reports: Array<Record<string, unknown>>) {
  const width = 620;
  const height = 150;
  const paddingBottom = 22;
  const paddingTop = 24;
  const usableHeight = height - paddingBottom - paddingTop;
  const numBuckets = 12;
  const buckets = new Array(numBuckets).fill(0);

  const timestamps = reports
    .map((r) => (r.created_at ? new Date(String(r.created_at)).getTime() : 0))
    .filter((t) => !isNaN(t) && t > 0)
    .sort((a, b) => a - b);

  if (timestamps.length >= 2) {
    const minTime = timestamps[0];
    const maxTime = timestamps[timestamps.length - 1];
    const timeSpan = Math.max(maxTime - minTime, 1);

    timestamps.forEach((t) => {
      const idx = Math.min(
        numBuckets - 1,
        Math.max(0, Math.floor(((t - minTime) / timeSpan) * numBuckets))
      );
      buckets[idx]++;
    });
  } else if (reports.length > 0) {
    reports.forEach((_, idx) => {
      buckets[idx % numBuckets]++;
    });
  } else {
    [2, 3, 4, 3, 5, 7, 4, 6, 8, 5, 4, 3].forEach((v, i) => {
      buckets[i] = v;
    });
  }

  const maxVal = Math.max(...buckets, 1);
  const points = buckets.map((count, i) => {
    const x = Math.round((i / (numBuckets - 1)) * width);
    const normalized = count / maxVal;
    const y = Math.round(height - paddingBottom - normalized * usableHeight);
    return { x, y };
  });

  let linePath = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = Math.round((prev.x + curr.x) / 2);
    linePath += ` C${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const areaPath = `${linePath} V${height} H0Z`;

  const earliestLabel = timestamps.length
    ? new Date(timestamps[0]).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : '24h ago';
  const latestLabel = timestamps.length
    ? new Date(timestamps[timestamps.length - 1]).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Live';

  return { linePath, areaPath, buckets, maxVal, earliestLabel, latestLabel };
}

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

  const telemetry = computeTelemetrySeries(reportList);

  // Derive attack pattern frequency from reports and campaigns
  const attackTypeCounts = new Map<string, number>();
  reportList.forEach((r) => {
    const title = String(r.title || '').toLowerCase();
    const severity = String(r.severity || '').toLowerCase();
    if (title.includes('credential') || title.includes('password') || title.includes('verify') || title.includes('login')) {
      attackTypeCounts.set('Credential Harvesting', (attackTypeCounts.get('Credential Harvesting') || 0) + 1);
    } else if (title.includes('invoice') || title.includes('payment') || title.includes('wire') || title.includes('transfer')) {
      attackTypeCounts.set('Invoice / Payment Fraud', (attackTypeCounts.get('Invoice / Payment Fraud') || 0) + 1);
    } else if (title.includes('urgent') || title.includes('notice') || title.includes('immediate')) {
      attackTypeCounts.set('Urgent Action Request', (attackTypeCounts.get('Urgent Action Request') || 0) + 1);
    } else if (severity === 'critical' || severity === 'high') {
      attackTypeCounts.set('High-Risk Exploit', (attackTypeCounts.get('High-Risk Exploit') || 0) + 1);
    } else {
      attackTypeCounts.set('Heuristic Phishing', (attackTypeCounts.get('Heuristic Phishing') || 0) + 1);
    }
  });
  const sortedAttacks = Array.from(attackTypeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const primaryAttackType = sortedAttacks[0]
    ? `${sortedAttacks[0][0]} (${sortedAttacks[0][1]})`
    : 'Credential Phishing';

  // Derive domain frequency
  const domainCounts = new Map<string, number>();
  campaigns.forEach((campaign) => {
    (Array.isArray(campaign.members) ? campaign.members : []).forEach((member) => {
      const item = member as Record<string, unknown>;
      if (item.sender_domain) {
        const d = String(item.sender_domain);
        domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
      }
    });
  });
  const sortedDomains = Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1]);
  const primaryDomain = sortedDomains[0]
    ? `${sortedDomains[0][0]} (${sortedDomains[0][1]}x)`
    : (domains.size > 0 ? Array.from(domains)[0] : 'None recorded');

  return (
    <AppShell
      title="Central Security Operations Center"
      subtitle="Federated threat correlation, cross-tenant intelligence & autonomous clustering"
      navItems={[...CENTRAL_NAV]}
    >
      <div className="central-dashboard">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="soc-kicker">Federated Security Operations</div>
          <h2 className="hero-title">
            Cross-tenant threat
            <br />
            <span>correlation & defense</span>
          </h2>
          <p className="hero-desc">
            Real-time machine learning clustering, IOC federation, and phishing campaign analysis across all connected institutions.
          </p>
          <div className="hero-actions">
            <Link href="/campaigns" className="btn-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              Campaign Center
            </Link>
            <Link href="/live-feed" className="btn-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                <circle cx="12" cy="12" r="2" />
                <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
              </svg>
              Live Threat Stream
            </Link>
            <Link href="/investigations" className="btn-ghost">
              Investigation Queue →
            </Link>
          </div>
        </div>

        <div className="stat-grid">
          <StatCard label="Critical threats" value={criticalCount} tone="critical" />
          <StatCard label="High-risk reports" value={highRiskReports.length} tone="high" />
          <StatCard label="Active campaigns" value={campaigns.length} tone="default" />
          <StatCard label="Campuses protected" value={organizationCount} tone="ok" />
        </div>

        <div className="central-hero-signal" aria-label="Real-time threat activity telemetry">
          <span>Live Velocity</span>
          <div aria-hidden="true">
            {telemetry.buckets.map((count, idx) => {
              const heightPct = Math.max(18, Math.round((count / telemetry.maxVal) * 100));
              return <i key={idx} style={{ height: `${heightPct}%` }} />;
            })}
          </div>
          <small>{reportList.length} threat reports correlated</small>
        </div>
      </section>

      <section className="central-telemetry-grid" aria-label="Threat activity overview">
        <article className="central-glass-panel central-activity-panel">
          <div className="central-panel-heading">
            <div><span>Threat Velocity</span><h2>Signals Over Time</h2></div>
            <span className="central-data-tag">LIVE STREAM</span>
          </div>
          <div className="central-chart-wrap">
            <svg viewBox="0 0 620 150" role="img" aria-label="Live threat activity time-series telemetry">
              <defs>
                <linearGradient id="dashboard-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#6366f1" stopOpacity=".35" />
                  <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="central-chart-area" d={telemetry.areaPath} />
              <path className="central-chart-line" d={telemetry.linePath} />
              <path className="central-chart-grid" d="M0 35H620 M0 75H620 M0 115H620" />
            </svg>
            <div className="central-chart-labels">
              <span>{telemetry.earliestLabel}</span>
              <span>{telemetry.latestLabel}</span>
            </div>
          </div>
        </article>

        <article className="central-glass-panel central-org-panel">
          <div className="central-panel-heading">
            <div><span>Federation Reach</span><h2>Campus Organizations</h2></div>
            <span className="central-data-tag">CONNECTED</span>
          </div>
          <div className="central-org-total">
            <strong>{organizationCount}</strong>
            <span>campuses participating</span>
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: '1px solid rgba(255, 255, 255, 0.07)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12 }}>
              <span>Multi-Tenant Ingestion</span>
              <strong style={{ color: '#10b981' }}>Active & Isolated</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12 }}>
              <span>Cross-Tenant Clusters</span>
              <strong style={{ color: '#f8fafc', fontFamily: '"JetBrains Mono", monospace' }}>{campaigns.length} clusters</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12 }}>
              <span>Federated Scope</span>
              <strong style={{ color: '#6366f1' }}>Headers & Hashes Only</strong>
            </div>
          </div>
        </article>

        <article className="central-glass-panel central-indicator-panel">
          <div className="central-panel-heading">
            <div><span>Threat Intelligence</span><h2>Top Attack Patterns</h2></div>
            <span className="central-data-tag">CLASSIFIED</span>
          </div>
          <div className="central-ranking-row">
            <span>Primary Attack Vector</span>
            <strong style={{ color: '#818cf8', fontSize: 13 }}>{primaryAttackType}</strong>
          </div>
          <div className="central-ranking-row">
            <span>Prevalent Malicious Domain</span>
            <strong style={{ color: '#fbbf24', fontSize: 13 }}>{primaryDomain}</strong>
          </div>
          <div className="central-ranking-row">
            <span>Observed Infrastructure</span>
            <strong style={{ color: '#38bdf8', fontSize: 13 }}>{domains.size} Domains · {sourceIps.size} IPs</strong>
          </div>
        </article>
      </section>

      <section className="page-toolbar">
        <div>
          <div className="soc-kicker">Priority queue · cross-tenant</div>
          <h2 className="page-section-title">Active Threat Campaigns</h2>
        </div>
        <Link href="/campaigns" className="btn-ghost">
          View all {campaigns.length} campaigns →
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