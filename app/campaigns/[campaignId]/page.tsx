import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralCampaignDetail } from '../../../lib/api';
import { CENTRAL_NAV } from '../../../lib/nav';

export default async function CampaignDetailPage({
  params
}: {
  params: { campaignId: string };
}) {
  const campaignId = decodeURIComponent(params.campaignId);
  const campaign = await fetchCentralCampaignDetail(campaignId);

  if (!campaign) {
    return (
      <AppShell
        title="Campaign not found"
        subtitle={campaignId}
        navItems={[...CENTRAL_NAV]}
      >
        <div className="art-empty-state">
          No campaign data returned for <code>{campaignId}</code>.
          <div style={{ marginTop: 16 }}>
            <Link href="/campaigns" className="art-inline-link">
              ← Back to campaigns
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const members = Array.isArray(campaign.members)
    ? (campaign.members as Array<Record<string, unknown>>)
    : [];
  const avgSim = members.length
    ? Math.round(
        (members.reduce((t, m) => t + Number(m.similarity || 0), 0) / members.length) * 100
      )
    : 0;

  return (
    <AppShell
      title={`Campaign ${campaignId}`}
      subtitle="Correlated fingerprint cluster"
      navItems={[...CENTRAL_NAV]}
    >
      <div style={{ marginBottom: 20 }}>
        <Link href="/campaigns" className="art-inline-link">
          ← All campaigns
        </Link>
      </div>

      <section className="report-stat-grid" style={{ marginBottom: 24 }}>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Fingerprints</div>
            <strong style={{ fontSize: 28 }}>{Number(campaign.email_count || members.length)}</strong>
          </div>
        </div>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Organizations</div>
            <strong style={{ fontSize: 28 }}>{Number(campaign.tenant_count || 0)}</strong>
          </div>
        </div>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Avg similarity</div>
            <strong style={{ fontSize: 28 }}>{avgSim}%</strong>
          </div>
        </div>
        <div className="evidence-gauge-card">
          <div>
            <div className="soc-kicker">Status</div>
            <strong style={{ fontSize: 18, color: '#76e6aa' }}>ACTIVE</strong>
          </div>
        </div>
      </section>

      {campaign.summary ? (
        <section
          style={{
            background: '#0f1a28',
            border: '1px solid #243b5b',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            color: '#c5d8ef',
            lineHeight: 1.6
          }}
        >
          <div className="soc-kicker" style={{ marginBottom: 8 }}>
            Campaign summary
          </div>
          {String(campaign.summary)}
        </section>
      ) : null}

      <section className="art-section-heading">
        <div>
          <div className="soc-kicker">Evidence</div>
          <h2>Member fingerprints</h2>
        </div>
      </section>

      {members.length === 0 ? (
        <div className="art-empty-state">No member fingerprints available for this campaign.</div>
      ) : (
        <div className="campaign-list">
          {members.map((member, index) => (
            <div key={index} className="campaign-list-card" style={{ cursor: 'default' }}>
              <div className="campaign-list-head">
                <div>
                  <div className="campaign-list-kicker">FINGERPRINT</div>
                  <div className="campaign-list-id" style={{ fontSize: 14 }}>
                    {String(member.fingerprint_id || member.sha256 || member.id || `member-${index}`)}
                  </div>
                </div>
                <span className="campaign-status">
                  {Math.round(Number(member.similarity || 0) * 100)}% match
                </span>
              </div>
              <div className="campaign-list-stats">
                <div>
                  <strong>{String(member.tenant_id || member.organization || '—')}</strong>
                  <span>Organization</span>
                </div>
                <div>
                  <strong>{String(member.sender_domain || '—')}</strong>
                  <span>Sender domain</span>
                </div>
                <div>
                  <strong>{String(member.source_ip || '—')}</strong>
                  <span>Source IP</span>
                </div>
                <div>
                  <strong>{String(member.subject || member.tlsh || '—')}</strong>
                  <span>Subject / TLSH</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
