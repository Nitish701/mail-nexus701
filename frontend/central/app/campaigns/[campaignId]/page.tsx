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
};

function formatDetailDate(value: unknown) {
  if (!value || String(value) === 'Unknown') return 'Not yet identified';
  const raw = String(value);
  if (raw.includes('T')) return raw.replace('T', ' ').slice(0, 16);
  return raw;
}

function getPlainEnglishSummary(campaign: Record<string, unknown>, members: CampaignMember[]) {
  if (campaign.summary && String(campaign.summary).trim()) {
    return String(campaign.summary);
  }

  const tenantCount = Number(campaign.tenant_count || new Set(members.map((member) => String(member.tenant_id || 'Unknown'))).size || 0);
  const messageCount = Number(campaign.email_count || members.length || 0);

  return `This campaign includes ${tenantCount} organizations and ${messageCount} related messages. Review the returned match reasons and member evidence below.`;
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

export default async function CampaignDetailPage({ params }: { params: { campaignId: string } }) {
  const campaign = await fetchCentralCampaignDetail(params.campaignId);

  if (!campaign) {
    return (
      <AppShell title="Campaign detail" subtitle="No campaign found" navItems={[...CENTRAL_NAV]}>
        <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24, borderRadius: 16 }}>
          <h2 style={{ margin: 0 }}>Campaign not available</h2>
          <p style={{ color: '#9fb5d8', marginTop: 12 }}>No campaign record exists for this identifier yet.</p>
          <Link href="/campaigns" style={{ color: '#8ec5ff', fontWeight: 700 }}>Return to campaigns</Link>
        </section>
      </AppShell>
    );
  }

  const members = Array.isArray(campaign.members) ? (campaign.members as CampaignMember[]) : [];
  const tenantCount = Number(campaign.tenant_count || members.length || 0);
  const emailCount = Number(campaign.email_count || members.length || 0);
  const similarityValues = members.map(getSimilarity).filter((value): value is number => value !== null);
  const avgSimilarity = similarityValues.length
    ? Math.round((similarityValues.reduce((total, value) => total + value, 0) / similarityValues.length) * 100)
    : 0;
  const organizations = [...new Set(members.map((member) => String(member.tenant_id || 'Unknown')))].join(', ');
  const reasons = [...new Set(members.flatMap(getMemberReasons))];
  const rankedMembers = [...members].sort((a, b) => (getSimilarity(b) ?? -1) - (getSimilarity(a) ?? -1));
  const sharedSourceIps = uniqueValues(members, 'source_ip');
  const sharedSenderDomains = uniqueValues(members, 'sender_domain');
  const summaryNarrative = getPlainEnglishSummary(campaign, members);

  return (
    <AppShell title="Campaign detail" subtitle="Cross-tenant evidence" navItems={[...CENTRAL_NAV]}>
      <div style={{ display: 'grid', gap: 18 }}>
        <Link href="/campaigns" style={{ color: '#8ec5ff', fontWeight: 700 }}>Back to campaigns</Link>

        <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#8ec5ff', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>Campaign</div>
              <h2 style={{ margin: '8px 0 0', fontSize: 28 }}>{String(campaign.campaign_id || 'Unknown campaign')}</h2>
            </div>
            <div style={{ background: '#172554', border: '1px solid #36558a', borderRadius: 999, padding: '10px 16px', color: '#dbeafe', fontWeight: 700 }}>
              {String(campaign.status || 'Active').toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 20 }}>
            <div style={{ background: '#0b1221', borderRadius: 12, border: '1px solid #243b5b', padding: 16 }}>
              <div style={{ color: '#9fb5d8', fontSize: 12, textTransform: 'uppercase' }}>Affected orgs</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{tenantCount}</div>
            </div>
            <div style={{ background: '#0b1221', borderRadius: 12, border: '1px solid #243b5b', padding: 16 }}>
              <div style={{ color: '#9fb5d8', fontSize: 12, textTransform: 'uppercase' }}>Related emails</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{emailCount}</div>
            </div>
            <div style={{ background: '#0b1221', borderRadius: 12, border: '1px solid #243b5b', padding: 16 }}>
              <div style={{ color: '#9fb5d8', fontSize: 12, textTransform: 'uppercase' }}>Pattern match</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{similarityValues.length ? `${avgSimilarity}%` : 'N/A'}</div>
            </div>
            <div style={{ background: '#0b1221', borderRadius: 12, border: '1px solid #243b5b', padding: 16 }}>
              <div style={{ color: '#9fb5d8', fontSize: 12, textTransform: 'uppercase' }}>First detected</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{formatDetailDate(campaign.first_seen || 'Unknown')}</div>
            </div>
          </div>
        </section>

        <section className="soc-chart-panel">
          <h3 style={{ margin: '0 0 16px', color: '#8ec5ff', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Correlation evidence</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ minWidth: 0, padding: 14, color: '#aabbd0', background: '#0b1523', border: '1px solid #243b5b', borderRadius: 10, fontSize: 12, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
              <h4 style={{ margin: '0 0 8px', color: '#dbeafe', fontSize: 13 }}>Why linked</h4>
              {reasons.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              ) : (
                <p>No match reasons were returned for this campaign.</p>
              )}
            </div>
            <div style={{ minWidth: 0, padding: 14, color: '#aabbd0', background: '#0b1523', border: '1px solid #243b5b', borderRadius: 10, fontSize: 12, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
              <h4 style={{ margin: '0 0 8px', color: '#dbeafe', fontSize: 13 }}>Shared infrastructure</h4>
              <p><strong>Source IPs:</strong> {sharedSourceIps.length ? sharedSourceIps.map(({ value, count }) => `${value} (${count} ${count === 1 ? 'member' : 'members'})`).join(', ') : 'None returned'}</p>
              <p><strong>Sender domains:</strong> {sharedSenderDomains.length ? sharedSenderDomains.map(({ value, count }) => `${value} (${count} ${count === 1 ? 'member' : 'members'})`).join(', ') : 'None returned'}</p>
            </div>
          </div>
        </section>

        <section className="soc-chart-panel">
          <div className="soc-chart-header">
            <div>
              <h3>Member correlation strength</h3>
              <p>Each related email’s similarity to this campaign (highest first).</p>
            </div>
          </div>
          {rankedMembers.length ? (
            <ol className="campaign-strength-list">
              {rankedMembers.map((member, index) => {
                const similarity = getSimilarity(member);
                const percentage = similarity === null ? null : Math.round(similarity * 100);
                return (
                  <li key={`${member.tenant_id ?? 'tenant'}-${member.observed_at || index}-${index}`} className={index === 0 && similarity !== null ? 'is-strongest' : ''}>
                    <span className="campaign-strength-rank">{index + 1}</span>
                    <div className="campaign-strength-content">
                      <div className="campaign-strength-heading">
                        <strong>{String(member.tenant_id || 'Unknown tenant')}</strong>
                        <span>{percentage === null ? 'Similarity unavailable' : `${percentage}%`}</span>
                      </div>
                      <div
                        className="campaign-strength-track"
                        role={percentage === null ? undefined : 'meter'}
                        aria-label={`Similarity for ${String(member.tenant_id || 'unknown tenant')}`}
                        aria-valuemin={percentage === null ? undefined : 0}
                        aria-valuemax={percentage === null ? undefined : 100}
                        aria-valuenow={percentage ?? undefined}
                      >
                        {percentage !== null && <span style={{ width: `${percentage}%` }} />}
                      </div>
                      <div className="campaign-strength-evidence">
                        <span><strong>Match reasons:</strong> {getMemberReasons(member).join(' · ') || 'Not returned'}</span>
                        <span><strong>Source IP:</strong> {member.source_ip || 'Unavailable'}</span>
                        <span><strong>Sender domain:</strong> {member.sender_domain || 'Unavailable'}</span>
                        <span><strong>Observed:</strong> {formatDetailDate(member.observed_at || 'Unknown')}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="soc-chart-empty">No member evidence is currently attached to this campaign.</div>
          )}
        </section>

        <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24, borderRadius: 16 }}>
          <h3 style={{ margin: '0 0 16px', color: '#8ec5ff', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>What this campaign means</h3>
          <div style={{ display: 'grid', gap: 10, color: '#dbeafe', lineHeight: 1.6 }}>
            <div><strong>What happened:</strong> Similar malicious messages were seen across {tenantCount} organizations, indicating a likely shared attack pattern.</div>
            <div><strong>Why they are linked:</strong> {reasons.length ? reasons.map((reason) => reason.replace(/_/g, ' ')).join(', ') : 'No match reasons were returned.'}</div>
            <div><strong>Affected organizations:</strong> {organizations || 'Unavailable'}</div>
            <div><strong>Time window:</strong> {formatDetailDate(campaign.first_seen || 'Unknown')} to {formatDetailDate(campaign.last_seen || 'Unknown')}</div>
            <div><strong>Assessment:</strong> {summaryNarrative}</div>
          </div>
        </section>

        <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24, borderRadius: 16 }}>
          <h3 style={{ margin: '0 0 18px', color: '#8ec5ff', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Evidence matrix</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {members.length === 0 ? (
              <div style={{ color: '#9fb5d8' }}>No member evidence is currently attached to this campaign.</div>
            ) : rankedMembers.map((member, index) => (
            <div key={`${member.tenant_id ?? 'tenant'}-${member.observed_at || index}-${index}`} className={`evidence-gauge-card ${index === 0 && getSimilarity(member) !== null ? 'is-strongest' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{index === 0 && getSimilarity(member) !== null ? 'Strongest match · ' : ''}{String(member.tenant_id || 'Unknown tenant')}</div>
                  <div className="similarity-gauge" style={{ background: `conic-gradient(#63c6ff ${Math.round((getSimilarity(member) ?? 0) * 100)}%, #20364f 0)` }}><div><strong>{getSimilarity(member) === null ? 'N/A' : `${Math.round((getSimilarity(member) ?? 0) * 100)}%`}</strong><span>match</span></div></div>
                </div>
                <div style={{ marginTop: 8, color: '#9fb5d8', fontSize: 13 }}>
                  <div>Correlation distance: {member.correlation_distance ?? 'N/A'} · Observed: {formatDetailDate(member.observed_at || 'Unknown')}</div>
                  <div style={{ marginTop: 5 }}>Evidence: {getMemberReasons(member).join(' · ') || 'Not returned'}</div>
                  <div style={{ marginTop: 5 }}>Sender domain: {member.sender_domain || 'Unavailable'} · Source infrastructure: {member.source_ip || 'Unavailable'}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}