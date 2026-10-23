import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { fetchCentralAllReports, fetchCentralCampaigns, fetchCentralOrganizations } from '../lib/api';
import { CENTRAL_NAV } from '../lib/nav';

function riskBadgeClass(severity: string) {
  const s = severity.toLowerCase();
  switch (s) {
    case 'critical': return 'badge badge-critical';
    case 'high': return 'badge badge-high';
    case 'medium': return 'badge badge-medium';
    case 'review': return 'badge badge-review';
    default: return 'badge badge-review';
  }
}

function displayTime(value: unknown) {
  if (!value) return 'Time unavailable';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default async function CentralHome() {
  const [reportsResponse, campaigns, organizations] = await Promise.all([
    fetchCentralAllReports(),
    fetchCentralCampaigns(),
    fetchCentralOrganizations()
  ]);

  const reportList = Array.isArray(reportsResponse.reports) ? reportsResponse.reports : [];
  const highRiskReports = reportList.filter((r) =>
    ['high', 'critical'].includes(String(r.severity || '').toLowerCase())
  );
  const criticalCount = reportList.filter(
    (r) => String(r.severity || '').toLowerCase() === 'critical'
  ).length;

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
    <AppShell title="SOC Overview" subtitle="Cross-tenant email threat correlation">
      <header className="page-intro">
        <div>
          <h1>Security operations overview</h1>
          <p>Review persisted email findings and cross-organization campaign activity.</p>
        </div>
        <Link href="/investigations" className="btn btn-primary btn-sm">Investigation queue</Link>
      </header>

      {/* 1. Compact KPI Row */}
      <section className="stat-grid" aria-label="Federated threat metrics">
        <StatCard
          label="Critical Threats"
          value={criticalCount}
          tone="critical"
          hint="Requires immediate containment"
        />
        <StatCard
          label="High-Risk Reports"
          value={highRiskReports.length}
          tone="high"
          hint="Crossing multi-layer threshold"
        />
        <StatCard
          label="Campaign records"
          value={campaigns.length}
          tone="review"
          hint="Records returned by the campaign API"
        />
        <StatCard
          label="Registered organizations"
          value={organizations.length}
          tone="ok"
          hint="Organizations in the registry"
        />
        <StatCard
          label="Email reports"
          value={reportList.length}
          tone="default"
          hint="Records returned by the reports API"
        />
      </section>

      {/* 2. Priority Queue Table — Emails that need attention first */}
      <section className="data-section" aria-label="Cross-tenant priority investigation queue">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Priority queue · Cross-organization triage</h2>
            <span className="section-desc">Persisted high and critical email findings requiring review.</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/investigations" className="btn btn-secondary btn-sm">
              Open investigation queue ({highRiskReports.length}) →
            </Link>
          </div>
        </div>

        {highRiskReports.length === 0 ? (
          <div className="empty-state">No high or critical email findings are currently recorded.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Ingested</th>
                  <th style={{ width: '130px' }}>Report ID</th>
                  <th style={{ width: '120px' }}>Campus Node</th>
                  <th>Threat Subject / Title</th>
                  <th style={{ width: '90px' }}>Severity</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {highRiskReports.slice(0, 5).map((r) => (
                  <tr key={String(r.report_id)}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {displayTime(r.created_at)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                      {String(r.report_id)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {String(r.organization_id ?? 'Not assigned')}
                    </td>
                    <td>
                      <Link
                        href={`/reports/${encodeURIComponent(String(r.report_id))}`}
                        className="table-subject-link"
                      >
                        {String(r.title || 'Untitled report')}
                      </Link>
                    </td>
                    <td>
                      <span className={riskBadgeClass(String(r.severity || ''))}>
                        {String(r.severity || 'Not provided')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/reports/${encodeURIComponent(String(r.report_id))}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Compact Live Activity Feed */}
      <section className="data-section" aria-label="Federated live threat stream">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Recent analyzed email reports</h2>
            <span className="section-desc">Recent persisted email findings across organizations.</span>
          </div>
          <Link href="/live-feed" className="btn btn-ghost btn-sm">
            Live stream monitor →
          </Link>
        </div>

        <div className="activity-feed-list">
          {reportList.length === 0 ? (
            <div className="empty-state">No emails analyzed yet.</div>
          ) : (
            reportList.slice(0, 4).map((r) => (
              <div className="activity-feed-item" key={`stream-${r.report_id}`}>
                <span className="activity-feed-time">{displayTime(r.created_at)}</span>
                <span className="activity-feed-tenant">{String(r.organization_id || 'Unassigned')}</span>
                <span className="activity-feed-title">
                  <strong style={{ color: 'var(--text-primary)' }}>{String(r.title || 'Email report')}</strong>
                  <span style={{ color: 'var(--text-muted)' }}> · {String(r.report_id)}</span>
                </span>
                <span className={riskBadgeClass(String(r.severity || ''))}>
                  {String(r.severity || 'Not provided')}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Active Campaigns as Short, Dense Cards */}
      <section className="data-section" aria-label="Active correlated campaigns">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Correlated Threat Campaigns</h2>
            <span className="section-desc">Cross-institution campaign clusters formed by structural TLSH and infrastructure overlap.</span>
          </div>
          <Link href="/campaigns" className="btn btn-secondary btn-sm">
            Campaign Center ({campaigns.length}) →
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="empty-state">No cross-tenant campaigns correlated yet. Fingerprints will appear as reports stream in.</div>
        ) : (
          <div className="campaign-grid">
            {campaigns.slice(0, 4).map((campaign) => {
              const members = Array.isArray(campaign.members)
                ? (campaign.members as Array<Record<string, unknown>>)
                : [];
              const campaignId = String(campaign.campaign_id || 'ID unavailable');
              const similarities = members
                .map((member) => member.similarity)
                .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
              const avgSim = similarities.length
                ? `${Math.round((similarities.reduce((total, value) => total + value, 0) / similarities.length) * 100)}%`
                : '—';

              return (
                <article className="campaign-dense-card" key={campaignId}>
                  <div className="campaign-card-head">
                    <div>
                      <div className="campaign-id-title">{campaignId}</div>
                      <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                        Last seen {displayTime(campaign.last_seen)}
                      </small>
                    </div>
                    <span className="badge badge-neutral">{String(campaign.status || 'Unknown')}</span>
                  </div>

                  <div className="campaign-meta-metrics">
                    <div className="campaign-metric-item">
                      <small>Messages</small>
                      <strong>{Number(campaign.email_count ?? members.length)}</strong>
                    </div>
                    <div className="campaign-metric-item">
                      <small>Campuses</small>
                      <strong>{typeof campaign.tenant_count === 'number' ? campaign.tenant_count : '—'}</strong>
                    </div>
                    <div className="campaign-metric-item">
                      <small>Avg. similarity</small>
                      <strong>{avgSim}</strong>
                    </div>
                  </div>

                  <div className="campaign-match-signals">
                    <span className="signal-tag">{members.length} campaign members</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                    {campaign.campaign_id ? (
                      <Link
                        href={`/campaigns/${encodeURIComponent(campaignId)}`}
                        className="action-link"
                      >
                        Cluster dossier →
                      </Link>
                    ) : (
                      <span className="text-muted">Campaign ID unavailable</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Threat Surface & Attack Pattern Summary */}
      <section className="data-section" aria-label="Threat surface overview">
        <div className="section-title-wrap">
          <h2 className="section-title">Federated Threat Surface Snapshot</h2>
          <span className="section-desc">Infrastructure and IOC indicators collected across connected institution borders.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Domains in campaign members
            </span>
            <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>
              {domains.size}
            </div>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Source IPs in campaign members
            </span>
            <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>
              {sourceIps.size}
            </div>
          </div>
        </div>
      </section>

    </AppShell>
  );
}
