import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { fetchCollegeCampaigns, fetchCollegeDashboardSummary } from '../lib/api';

const appTitle = process.env.NEXT_PUBLIC_APP_NAME || 'Mail-Nexus Organization Security Portal';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Emails', href: '/emails' },
  { label: 'Threats', href: '/threats' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Reports', href: '/reports' }
];

function riskClass(value: string) {
  return `badge badge-${value.toLowerCase()}`;
}

function displayTime(value: unknown) {
  if (!value) return 'Time unavailable';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

export default async function CollegeHome() {
  const [summary, campaigns] = await Promise.all([
    fetchCollegeDashboardSummary(),
    fetchCollegeCampaigns()
  ]);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status.toUpperCase() === 'ACTIVE');
  const recentEmails = Array.isArray(summary?.recent_suspicious_emails)
    ? summary.recent_suspicious_emails
    : [];

  return (
    <AppShell title={appTitle} subtitle="Institutional view" navItems={navItems}>
      <section className="workspace-intro">
        <div>
          <div className="eyebrow">Security intelligence</div>
          <h2>Monitor. Detect. Respond.</h2>
          <p>See today&apos;s email activity, items needing attention, and related threats in one place.</p>
        </div>
        <div className="intro-mark">MN / 01</div>
      </section>

      <section className="stat-grid" aria-label="Email security overview">
        {[
          { label: `Scans today${summary ? ` (${summary.day_timezone})` : ''}`, value: summary?.emails_today ?? '—', detail: 'Since local midnight' },
          { label: 'Review-level reports', value: summary?.needs_review ?? '—', detail: 'Medium + review · all saved reports' },
          { label: 'High-risk reports', value: summary?.high_risk ?? '—', detail: 'High + critical · all saved reports' },
          { label: 'Active campaigns', value: summary?.active_campaign_count ?? '—', detail: 'Currently active' }
        ].map(({ label, value, detail }, index) => (
          <div className="stat-card" key={String(label)}>
            <span className="stat-index">{String(index + 1).padStart(2, '0')}</span>
            <label>{label}</label>
            <strong>{value}</strong>
            <span className="stat-detail">{detail}</span>
          </div>
        ))}
      </section>

      <section className="data-section">
        <div className="section-heading">
          <div>
            <h2>Recent flagged emails</h2>
            <div className="muted">Latest medium-, high-risk, and analyst-review reports. Open one to inspect its evidence.</div>
          </div>
          <Link className="dashboard-action-link" href="/reports">View all reports <span aria-hidden="true">→</span></Link>
        </div>
        {!summary ? (
          <p className="muted">Dashboard email metrics are temporarily unavailable.</p>
        ) : recentEmails.length === 0 ? (
          <p className="muted">No suspicious emails need attention right now.</p>
        ) : (
          <div className="dashboard-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Time</th><th>Sender</th><th>Subject</th><th>Risk</th><th>Review</th></tr>
              </thead>
              <tbody>
                {recentEmails.map((email) => (
                  <tr key={email.report_id}>
                    <td>{displayTime(email.created_at)}</td>
                    <td>{email.sender || 'Sender unavailable'}</td>
                    <td>
                      <Link className="dashboard-subject-link" href={`/reports/${encodeURIComponent(email.report_id)}`}>
                        {email.subject || email.title}
                      </Link>
                    </td>
                    <td><span className={riskClass(email.severity)}>{email.severity}</span></td>
                    <td><Link className="dashboard-action-link dashboard-action-link-small" href={`/reports/${encodeURIComponent(email.report_id)}`}>Inspect <span aria-hidden="true">→</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="data-section dashboard-campaign-section">
        <div className="section-heading">
          <div>
            <h2>Active campaign alerts</h2>
            <div className="muted">Related suspicious emails grouped by the existing correlation system.</div>
          </div>
          <Link className="dashboard-action-link" href="/campaigns">All campaigns <span aria-hidden="true">→</span></Link>
        </div>
        {activeCampaigns.length === 0 ? (
          <p className="muted">No active campaigns detected.</p>
        ) : (
          <>
            <div className="correlation-explainer">
              <strong>How correlation works</strong>
              <p>
                Each new email is compared with emails from other tenants seen in the previous {activeCampaigns[0]?.correlation_window_minutes ?? 60} minutes.
                It joins a group when it shares a sender IP or domain, or has a similar message fingerprint
                (TLSH distance at or below {activeCampaigns[0]?.tlsh_max_distance ?? 100}; lower distance means more similar).
                The score shown on each member is a matching score, not a probability that the email is malicious.
              </p>
              <p>New matches record the exact email pair, matching method, similarity, and TLSH distance when applicable. Older campaigns may not have saved pair-level links.</p>
              <p>Only email members belonging to this organization are listed. Other organizations&apos; identities and message details are hidden.</p>
            </div>
            <div className="dashboard-campaign-list">
              {activeCampaigns.map((campaign) => {
                const members = Array.isArray(campaign.members) ? campaign.members : [];
                const correlations = Array.isArray(campaign.correlations) ? campaign.correlations : [];
                const membersById = new Map(members.map((member) => [member.fingerprint_id, member]));
                return (
                <article className="dashboard-campaign-card" key={campaign.campaign_id}>
                  <header className="dashboard-campaign-header">
                    <div>
                      <span className="eyebrow">Correlation group</span>
                      <h3>{campaign.campaign_id}</h3>
                      <p>{campaign.email_count} related emails · {campaign.tenant_count} tenant(s) in this organization</p>
                    </div>
                    <div className="dashboard-campaign-header-meta">
                      <span className="badge badge-review">ACTIVE</span>
                      <span>Last seen {displayTime(campaign.last_seen)}</span>
                    </div>
                  </header>
                  {campaign.cross_organization_matches_hidden && (
                    <div className="correlation-privacy-note">
                      This group also matched emails from other organizations. Their member details are withheld here.
                    </div>
                  )}
                  <div className="correlation-members-heading">
                    <strong>Campaign members and their matching signals</strong>
                    <span>{members.length} shown</span>
                  </div>
                  {members.length === 0 ? (
                    <p className="dashboard-campaign-empty">No member details are available for this organization.</p>
                  ) : (
                    <ol className="correlation-member-list">
                      {members.map((member) => {
                        const reasons = Array.isArray(member.match_reasons) ? member.match_reasons : [];
                        const relatedMembers = Array.isArray(member.related_members) ? member.related_members : [];
                        return (
                          <li className="correlation-member" id={`fingerprint-${member.fingerprint_id}`} key={member.fingerprint_id}>
                            <span className="correlation-member-connector" aria-hidden="true" />
                            <div className="correlation-member-main">
                              <div className="correlation-member-title">
                                <strong>{member.subject || 'Subject unavailable'}</strong>
                                {typeof member.risk_score === 'number' && (
                                  <span className="correlation-risk-score">Score {Math.round(member.risk_score)}</span>
                                )}
                              </div>
                              <div className="correlation-member-meta">
                                <span>Tenant: {member.tenant_id}</span>
                                <span>Sender domain: {member.sender_domain || 'Unavailable'}</span>
                                <span>Source IP: {member.source_ip || 'Unavailable'}</span>
                                <span>Observed: {displayTime(member.observed_at)}</span>
                                {member.message_id && <span>Message ID: {member.message_id}</span>}
                              </div>
                              <div className="correlation-reasons" aria-label="Why this email is correlated">
                                {reasons.map((reason) => <span className="correlation-reason" key={reason}>{reason}</span>)}
                                {reasons.length === 0 && (
                                  <span className="correlation-reason">
                                    {correlations.length > 0 ? 'See the exact pair links below' : 'Pair-level correlation detail unavailable'}
                                  </span>
                                )}
                              </div>
                              {relatedMembers.length > 0 && (
                                <div className="correlation-direct-links">
                                  <strong>Directly related to:</strong>
                                  {relatedMembers.map((related) => (
                                    <span key={related.fingerprint_id}>
                                      <a className="correlation-peer-link" href={`#fingerprint-${related.fingerprint_id}`}>
                                        {related.subject || `Email #${related.fingerprint_id}`}
                                      </a>
                                      {' '}· {(Array.isArray(related.signals) ? related.signals : []).join(' + ')} · {displayTime(related.observed_at)}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {member.hidden_related_count > 0 && (
                                <div className="correlation-hidden-links">
                                  {member.hidden_related_count} direct match(es) from other organizations hidden
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <section className="correlation-edge-section" aria-label="Exact email correlation links">
                    <h4>Exact correlation links</h4>
                    {correlations.length > 0 ? (
                      <ol className="correlation-edge-list">
                        {correlations.map((edge) => {
                          const source = membersById.get(edge.source_fingerprint_id);
                          const matched = membersById.get(edge.matched_fingerprint_id);
                          const method = edge.match_method === 'shared_source_ip'
                            ? 'Shared sender IP'
                            : edge.match_method === 'shared_sender_domain'
                              ? 'Shared sender domain'
                              : edge.match_method === 'shared_source_ip+shared_sender_domain'
                                ? 'Shared sender IP and domain'
                                : 'Similar message fingerprint (TLSH)';
                          return (
                            <li key={`${edge.source_fingerprint_id}-${edge.matched_fingerprint_id}`}>
                              <a className="correlation-peer-link" href={`#fingerprint-${edge.source_fingerprint_id}`}>
                                {source?.subject || `Email #${edge.source_fingerprint_id}`}
                              </a>
                              <span aria-hidden="true"> ↔ </span>
                              <a className="correlation-peer-link" href={`#fingerprint-${edge.matched_fingerprint_id}`}>
                                {matched?.subject || `Email #${edge.matched_fingerprint_id}`}
                              </a>
                              <span className="correlation-edge-detail">
                                {method} · {Math.round(edge.similarity * 100)}% similarity
                                {edge.match_method === 'similar_fingerprint' && edge.correlation_distance !== null && ` · TLSH distance ${edge.correlation_distance}`}
                                {` · Recorded ${displayTime(edge.matched_at)}`}
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="correlation-history-note">
                        {campaign.historical_links_unavailable
                          ? 'This campaign predates saved pair-level links. Exact historical TLSH peer relationships cannot be recovered; only visible shared-IP/domain patterns are shown above.'
                          : 'No exact pair-level links are available.'}
                      </p>
                    )}
                    {campaign.hidden_correlation_count > 0 && (
                      <p className="correlation-history-note">
                        {campaign.hidden_correlation_count} exact link(s) involving another organization are withheld.
                      </p>
                    )}
                  </section>
                </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
