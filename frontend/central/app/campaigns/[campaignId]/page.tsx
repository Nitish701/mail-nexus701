import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralCampaignDetail } from '../../../lib/api';
import { CENTRAL_NAV } from '../../../lib/nav';

type CampaignMember = {
  tenant_id?: string | number;
  similarity?: number | null;
  correlation_distance?: number;
  source_ip?: string;
  sender_domain?: string;
  observed_at?: string;
  match_reasons?: string[];
  subject?: string;
  message_id?: string;
};

function formatDetailDate(value: unknown) {
  if (!value || String(value) === 'Unknown') return 'Time unavailable';
  const raw = String(value);
  if (raw.includes('T')) return raw.replace('T', ' ').slice(0, 16);
  return raw;
}

function getMemberReasons(member: CampaignMember) {
  return Array.isArray(member.match_reasons)
    ? member.match_reasons.filter((reason) => typeof reason === 'string' && reason.trim().length > 0)
    : [];
}

function getSimilarity(member: CampaignMember) {
  if (member.similarity === null || member.similarity === undefined) return null;
  const similarity = Number(member.similarity);
  return Number.isFinite(similarity) ? Math.min(1, Math.max(0, similarity)) : null;
}

function uniqueValues(members: CampaignMember[], key: 'source_ip' | 'sender_domain') {
  const counts = new Map<string, number>();
  members.forEach((member) => {
    const value = member[key]?.trim();
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

export default async function CampaignDetailPage({
  params
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = await fetchCentralCampaignDetail(campaignId);

  if (!campaign) {
    return (
      <AppShell title="Campaign Detail" subtitle="Unknown cluster" navItems={[...CENTRAL_NAV]}>
        <section className="data-section">
          <div className="empty-state">
            No active campaign found for identifier &quot;{campaignId}&quot;.
          </div>
          <Link href="/campaigns" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
            ← Return to campaign center
          </Link>
        </section>
      </AppShell>
    );
  }

  const members = Array.isArray(campaign.members) ? (campaign.members as CampaignMember[]) : [];
  const tenantCount = typeof campaign.tenant_count === 'number'
    ? campaign.tenant_count
    : new Set(members.map((member) => member.tenant_id).filter((id) => id !== null && id !== undefined).map(String)).size;
  const emailCount = Number(campaign.email_count ?? members.length);
  const similarityValues = members.map(getSimilarity).filter((v): v is number => v !== null);
  const avgSimilarity = similarityValues.length
    ? Math.round((similarityValues.reduce((tot, v) => tot + v, 0) / similarityValues.length) * 100)
    : null;

  const sharedSourceIps = uniqueValues(members, 'source_ip');
  const sharedSenderDomains = uniqueValues(members, 'sender_domain');

  return (
    <AppShell title="Campaign Forensic Dossier" subtitle={campaignId} navItems={[...CENTRAL_NAV]}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <Link href="/campaigns" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
          ← Back to campaign center
        </Link>
        <span className="badge badge-high">
          {String(campaign.status || 'Not provided').toUpperCase()}
        </span>
      </div>

      {/* KPI Stat Cards */}
      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-card-label">Campaign ID</span>
          <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: '4px' }}>
            {campaignId}
          </div>
          <span className="stat-card-detail">Correlation cluster key</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Correlated Messages</span>
          <div className="stat-card-value">{emailCount}</div>
          <span className="stat-card-detail">Inbound emails matched</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Campuses Targeted</span>
          <div className="stat-card-value">{tenantCount}</div>
          <span className="stat-card-detail">Unique institution tenants</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Pattern Match</span>
          <div className="stat-card-value">{avgSimilarity === null ? '—' : `${avgSimilarity}%`}</div>
          <span className="stat-card-detail">TLSH structural similarity</span>
        </div>
      </section>

      {/* Campaign Infrastructure Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
        <section className="data-section">
          <div className="section-title-wrap">
            <h3 className="section-title">Shared Sender Domains ({sharedSenderDomains.length})</h3>
            <span className="section-desc">Domains appearing across clustered messages</span>
          </div>
          <div className="report-code-block">
            {sharedSenderDomains.length > 0
              ? sharedSenderDomains.map((d) => `${d.value} (${d.count}x)`).join('\n')
              : 'None recorded'}
          </div>
        </section>

        <section className="data-section">
          <div className="section-title-wrap">
            <h3 className="section-title">Shared Source IPs ({sharedSourceIps.length})</h3>
            <span className="section-desc">Host infrastructure observed connecting to mail nodes</span>
          </div>
          <div className="report-code-block">
            {sharedSourceIps.length > 0
              ? sharedSourceIps.map((ip) => `${ip.value} (${ip.count}x)`).join('\n')
              : 'None recorded'}
          </div>
        </section>
      </div>

      {/* Member Messages Table */}
      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Cluster Members & Evidence Signals ({members.length})</h2>
            <span className="section-desc">Institutional emails linked to this campaign group with individual match reasons.</span>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="empty-state">No individual member records available for this cluster.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Observed</th>
                  <th style={{ width: '110px' }}>Tenant Node</th>
                  <th>Subject / Identifier</th>
                  <th style={{ width: '150px' }}>Sender Domain</th>
                  <th style={{ width: '130px' }}>Source IP</th>
                  <th style={{ width: '90px' }}>Similarity</th>
                  <th>Match Reasons</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => {
                  const sim = getSimilarity(m);
                  const reasons = getMemberReasons(m);
                  return (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatDetailDate(m.observed_at)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                        {String(m.tenant_id ?? 'Not provided')}
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {m.subject || m.message_id || 'Identifier unavailable'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {m.sender_domain || 'Omitted'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {m.source_ip || 'Omitted'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {sim !== null ? `${Math.round(sim * 100)}%` : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {reasons.length > 0 ? (
                            reasons.map((r) => <span className="signal-tag" key={r}>{r}</span>)
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
        )}
      </section>
    </AppShell>
  );
}
