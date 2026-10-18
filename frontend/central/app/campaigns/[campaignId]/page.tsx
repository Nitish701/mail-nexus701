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

export default async function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const campaign = await fetchCentralCampaignDetail(campaignId);

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
    <AppShell title="Campaign Cluster Forensic Evidence" subtitle="Cross-tenant cluster correlation and similarity analysis" navItems={[...CENTRAL_NAV]}>
      <div className="soc-subpage">
        <Link href="/campaigns" className="report-back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          ← Back to campaign center
        </Link>

        <section className="soc-card">
          <div className="soc-card-header">
            <div>
              <div style={{ color: '#8ec5ff', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700 }}>Campaign Cluster</div>
              <h2 style={{ margin: '6px 0 0', fontSize: 24 }}>{String(campaign.campaign_id || 'Unknown campaign')}</h2>
            </div>
            <span className="soc-badge high" style={{ fontSize: 12, padding: '6px 14px' }}>
              {String(campaign.status || 'Active').toUpperCase()}
            </span>
          </div>

          <div className="soc-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <div className="soc-card" style={{ padding: 16, background: '#0a101d' }}>
                <div style={{ color: '#8fa2bd', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Affected Orgs</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: '#f1f5fb', fontFamily: '"JetBrains Mono", monospace' }}>{tenantCount}</div>
              </div>
              <div className="soc-card" style={{ padding: 16, background: '#0a101d' }}>
                <div style={{ color: '#8fa2bd', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Related Emails</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: '#f1f5fb', fontFamily: '"JetBrains Mono", monospace' }}>{emailCount}</div>
              </div>
              <div className="soc-card" style={{ padding: 16, background: '#0a101d' }}>
                <div style={{ color: '#8fa2bd', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Pattern Match</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: '#38bdf8', fontFamily: '"JetBrains Mono", monospace' }}>{similarityValues.length ? `${avgSimilarity}%` : 'N/A'}</div>
              </div>
              <div className="soc-card" style={{ padding: 16, background: '#0a101d' }}>
                <div style={{ color: '#8fa2bd', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>First Detected</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8, color: '#cbd7e6', fontFamily: '"JetBrains Mono", monospace' }}>{formatDetailDate(campaign.first_seen || 'Unknown')}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="soc-card">
          <div className="soc-card-header">
            <h3 style={{ margin: 0, color: '#8ec5ff', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Correlation Evidence Summary</h3>
          </div>
          <div className="soc-card-body">
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

        <section className="soc-card">
          <div className="soc-card-header">
            <h3 style={{ margin: 0, color: '#8ec5ff', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>What this campaign means</h3>
          </div>
          <div className="soc-card-body">
            <div style={{ display: 'grid', gap: 12, color: '#dbeafe', lineHeight: 1.6, fontSize: 13 }}>
              <div><strong>What happened:</strong> Similar malicious messages were seen across {tenantCount} organizations, indicating a likely shared attack pattern.</div>
              <div><strong>Why they are linked:</strong> {reasons.length ? reasons.map((reason) => reason.replace(/_/g, ' ')).join(', ') : 'No match reasons were returned.'}</div>
              <div><strong>Affected organizations:</strong> {organizations || 'Unavailable'}</div>
              <div><strong>Time window:</strong> {formatDetailDate(campaign.first_seen || 'Unknown')} to {formatDetailDate(campaign.last_seen || 'Unknown')}</div>
              <div><strong>Assessment:</strong> {summaryNarrative}</div>
            </div>
          </div>
        </section>

        <section className="soc-card">
          <div className="soc-card-header">
            <h3 style={{ margin: 0, color: '#8ec5ff', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Member Evidence Matrix</h3>
          </div>
          <div className="soc-card-body">
            {members.length === 0 ? (
              <div style={{ color: '#9fb5d8' }}>No member evidence is currently attached to this campaign.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {rankedMembers.map((member, index) => (
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
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}