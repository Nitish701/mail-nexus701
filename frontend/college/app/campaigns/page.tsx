import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCollegeCampaigns, CorrelationCampaign } from '../../lib/api';

function displayTime(value: unknown) {
  if (!value) return 'Unknown';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default async function CollegeCampaignsPage() {
  const campaigns = await fetchCollegeCampaigns();

  return (
    <AppShell title="Campaign Center" subtitle="Coordinated email threat groups">
      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Detected Cross-Tenant Campaigns ({campaigns.length})</h2>
            <span className="section-desc">Email messages clustered via Locality Sensitive Hashing (TLSH) and sender infrastructure.</span>
          </div>
          <Link href="/" className="btn btn-ghost btn-sm">
            ← Back to dashboard
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="empty-state">No coordinated phishing or attack campaigns detected for this institution.</div>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>Campaign ID</th>
                    <th style={{ width: '100px' }}>Status</th>
                    <th style={{ width: '130px' }}>First Seen</th>
                    <th style={{ width: '130px' }}>Last Seen</th>
                    <th style={{ width: '90px' }}>Emails</th>
                    <th style={{ width: '100px' }}>Campus Orgs</th>
                    <th>Match Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c: CorrelationCampaign) => {
                    const members = Array.isArray(c.members) ? c.members : [];
                    const matchReasons = Array.from(new Set(members.flatMap((m) => m.match_reasons || []))).slice(0, 3);
                    return (
                      <tr key={String(c.campaign_id)}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {String(c.campaign_id)}
                        </td>
                        <td>
                          <span className="badge badge-high">
                            {String(c.status || 'Not provided').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {displayTime(c.first_seen)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {displayTime(c.last_seen)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {String(c.email_count ?? '—')}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {String(c.tenant_count ?? '—')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {matchReasons.length > 0 ? (
                              matchReasons.map((r) => (
                                <span className="signal-tag" key={r}>{r}</span>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No match reason recorded</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </>
        )}
      </section>
    </AppShell>
  );
}
