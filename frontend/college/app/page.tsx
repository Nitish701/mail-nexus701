import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { fetchCollegeCampaigns, fetchCollegeDashboardSummary, CorrelationCampaign } from '../lib/api';

function riskBadgeClass(value: string) {
  const v = value.toLowerCase();
  switch (v) {
    case 'critical':
      return 'badge badge-critical';
    case 'high':
      return 'badge badge-high';
    case 'medium':
      return 'badge badge-medium';
    case 'review':
      return 'badge badge-review';
    case 'safe':
    case 'low':
      return 'badge badge-low';
    default:
      return 'badge badge-neutral';
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

function timeAgo(value: unknown) {
  if (!value) return 'Time unavailable';
  const ts = new Date(String(value)).getTime();
  if (Number.isNaN(ts)) return String(value);
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export default async function CollegeHome() {
  const [summary, campaigns] = await Promise.all([
    fetchCollegeDashboardSummary(),
    fetchCollegeCampaigns()
  ]);

  const activeCampaigns = campaigns.filter(
    (campaign) => (campaign.status || '').toUpperCase() === 'ACTIVE'
  );
  const recentEmails = Array.isArray(summary?.recent_suspicious_emails)
    ? summary.recent_suspicious_emails
    : [];

  return (
    <AppShell title="Dashboard" subtitle="Institutional email threats">
      <header className="page-intro">
        <div>
          <h1>Security overview</h1>
          <p>Review analyzed email activity and open findings for your institution.</p>
        </div>
        <Link href="/emails" className="btn btn-primary btn-sm">Email analysis</Link>
      </header>

      {/* 1. Compact KPI Row */}
      <section className="stat-grid" aria-label="Operational email metrics">
        <div className="stat-card">
          <span className="stat-card-label">
            Scans Today {summary ? `(${summary.day_timezone})` : ''}
          </span>
          <div className="stat-card-value">{summary?.emails_today ?? '—'}</div>
          <span className="stat-card-detail">Ingested since midnight</span>
        </div>

        <div className="stat-card tone-review">
          <span className="stat-card-label">Needs Review</span>
          <div className="stat-card-value">{summary?.needs_review ?? '—'}</div>
          <span className="stat-card-detail">Medium + review status</span>
        </div>

        <div className="stat-card tone-critical">
          <span className="stat-card-label">High / Critical</span>
          <div className="stat-card-value">{summary?.high_risk ?? '—'}</div>
          <span className="stat-card-detail">Urgent analyst triage</span>
        </div>

        <div className="stat-card tone-high">
          <span className="stat-card-label">Active Campaigns</span>
          <div className="stat-card-value">{summary?.active_campaign_count ?? activeCampaigns.length}</div>
          <span className="stat-card-detail">Correlated threat groups</span>
        </div>
      </section>

      {/* 2. Priority Queue Table — Emails that need attention first */}
      <section className="data-section" aria-label="Priority investigation queue">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Priority Queue · Awaiting Triage</h2>
            <span className="section-desc">Flagged emails ranked by risk severity. Inspect evidence to confirm or clear.</span>
          </div>
          <Link href="/reports" className="btn btn-secondary btn-sm">
            View all reports →
          </Link>
        </div>

        {!summary ? (
          <div className="empty-state">Email metrics are temporarily unavailable.</div>
        ) : recentEmails.length === 0 ? (
          <div className="empty-state">Queue clear. No emails currently require immediate triage.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Received</th>
                  <th style={{ width: '220px' }}>Sender</th>
                  <th>Subject</th>
                  <th style={{ width: '100px' }}>Risk</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentEmails.map((email) => (
                  <tr key={email.report_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {displayTime(email.created_at)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.sender || 'Sender hidden/omitted'}
                    </td>
                    <td>
                      <Link
                        className="table-subject-link"
                        href={`/reports/${encodeURIComponent(email.report_id)}`}
                      >
                        {email.subject || email.title}
                      </Link>
                    </td>
                    <td>
                      <span className={riskBadgeClass(email.severity)}>
                        {email.severity}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        className="btn btn-secondary btn-sm"
                        href={`/reports/${encodeURIComponent(email.report_id)}`}
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
      <section className="data-section" aria-label="Live threat activity feed">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Activity Feed</h2>
            <span className="section-desc">Chronological stream of scanned mail and system events.</span>
          </div>
          <Link href="/emails" className="btn btn-ghost btn-sm">
            Full email queue →
          </Link>
        </div>

        <div className="activity-feed-list">
          {recentEmails.length === 0 ? (
            <div className="empty-state">No emails analyzed yet.</div>
          ) : (
            recentEmails.slice(0, 4).map((item) => (
              <div className="activity-feed-item" key={`feed-${item.report_id}`}>
                <span className="activity-feed-time">{timeAgo(item.created_at)}</span>
                <span className="activity-feed-title">
                  <span style={{ color: 'var(--text-muted)' }}>Flagged </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{item.subject || item.title}</strong>
                  <span style={{ color: 'var(--text-muted)' }}> from {item.sender || 'external host'}</span>
                </span>
                <span className={riskBadgeClass(item.severity)}>{item.severity}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Active Campaigns as Short, Dense Cards */}
      <section className="data-section" aria-label="Active campaign clusters">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Active Campaign Clusters</h2>
            <span className="section-desc">Suspicious emails linked by infrastructure, IP, or message fingerprinting.</span>
          </div>
          <Link href="/campaigns" className="btn btn-secondary btn-sm">
            All campaigns ({campaigns.length}) →
          </Link>
        </div>

        {activeCampaigns.length === 0 ? (
          <div className="empty-state">No coordinated campaign clusters currently active.</div>
        ) : (
          <div className="campaign-grid">
            {activeCampaigns.slice(0, 4).map((campaign: CorrelationCampaign) => {
              const members = Array.isArray(campaign.members) ? campaign.members : [];
              const reasons = Array.from(new Set(members.flatMap((m) => m.match_reasons || []))).slice(0, 3);
              return (
                <article className="campaign-dense-card" key={campaign.campaign_id}>
                  <div className="campaign-card-head">
                    <div>
                      <div className="campaign-id-title">{campaign.campaign_id}</div>
                      <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                        Seen {displayTime(campaign.last_seen)}
                      </small>
                    </div>
                    <span className="badge badge-high">ACTIVE</span>
                  </div>

                  <div className="campaign-meta-metrics">
                    <div className="campaign-metric-item">
                      <small>Emails</small>
                      <strong>{campaign.email_count}</strong>
                    </div>
                    <div className="campaign-metric-item">
                      <small>Campus Orgs</small>
                      <strong>{campaign.tenant_count}</strong>
                    </div>
                    <div className="campaign-metric-item">
                      <small>Signals</small>
                      <strong>{members.length}</strong>
                    </div>
                  </div>

                  <div className="campaign-match-signals">
                    {reasons.length > 0 ? (
                      reasons.map((r) => (
                        <span className="signal-tag" key={r}>{r}</span>
                      ))
                    ) : (
                      <span className="signal-tag">TLSH / Domain Match</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                    <Link
                      href={`/campaigns`}
                      className="action-link"
                    >
                      Inspect cluster →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Secondary "How It Works" Surface — Collapsible Disclosure */}
      <details className="how-it-works-disclosure">
        <summary className="how-it-works-trigger">
          <span>Methodology & Cross-Tenant Privacy Controls</span>
          <span style={{ color: 'var(--accent)', fontSize: '11px' }}>Show details ▾</span>
        </summary>
        <div className="how-it-works-content">
          <div>
            <strong>Correlation Logic:</strong> Inbound messages are matched against threats observed across institutions
            within a sliding window ({activeCampaigns[0]?.correlation_window_minutes ?? 60} minutes). Grouping evaluates
            shared sender IPs, registered domain reputation, and Trend Micro Locality Sensitive Hashing (TLSH max distance{' '}
            {activeCampaigns[0]?.tlsh_max_distance ?? 100}).
          </div>
          <div>
            <strong>Tenant Privacy:</strong> Only threat telemetry and member reports belonging to your institution are
            revealed in full text. Cross-institution matches withhold PII, recipient mailboxes, and peer tenant identifiers.
          </div>
        </div>
      </details>
    </AppShell>
  );
}
