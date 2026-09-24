import { AppShell } from '../../components/AppShell';
import { fetchCentralCampaigns } from '../../lib/api';

const navItems = [{ label: 'SOC Overview', href: '/' }, { label: 'Live Feed', href: '/live-feed' }, { label: 'Campaigns', href: '/campaigns' }, { label: 'Campaign Graph', href: '/campaign-graph' }, { label: 'Investigations', href: '/investigations' }, { label: 'Threat Intelligence', href: '/threat-intelligence' }, { label: 'Tenants', href: '/tenants' }, { label: 'Reports', href: '/reports' }, { label: 'System Health', href: '/system-health' }];

type Member = { tenant_id?: string; similarity?: number; correlation_distance?: number; match_reasons?: string[] };

export default async function CampaignGraphPage() {
  const campaigns = await fetchCentralCampaigns();
  const safeCampaigns = Array.isArray(campaigns) ? campaigns.filter((campaign) => campaign && typeof campaign === 'object') : [];
  const campaign = safeCampaigns[0] ?? null;
  const members = Array.isArray(campaign?.members) ? campaign.members as Member[] : [];
  return <AppShell title="Campaign relationship graph" subtitle="Evidence-led investigation" navItems={navItems}>
    <section className="graph-hero"><div><div className="eyebrow">Correlation workspace</div><h2>{campaign ? String(campaign.campaign_id) : 'No active campaign'}</h2><p>{campaign ? 'Relationship evidence connecting participating organizations through fingerprint similarity.' : 'The graph will populate when suspicious emails correlate across organizations.'}</p></div><div className="graph-status">{campaign ? String(campaign.status || 'ACTIVE') : 'WAITING'}</div></section>
    {campaign ? <>
      <section className="graph-layout"><div className="relationship-graph"><div className="graph-center"><span>CAMPAIGN</span><strong>{String(campaign.campaign_id)}</strong></div>{members.map((member, index) => <div className={`graph-node graph-node-${index % 4}`} key={`${member.tenant_id}-${index}`}><span>ORGANIZATION</span><strong>{member.tenant_id || 'Unknown tenant'}</strong><small>{Math.round(Number(member.similarity || 0) * 100)}% similarity</small></div>)}</div>
        <aside className="evidence-panel"><h3>Correlation evidence</h3><div className="evidence-row"><span>Affected organizations</span><strong>{String(campaign.tenant_count || members.length)}</strong></div><div className="evidence-row"><span>Related emails</span><strong>{String(campaign.email_count || members.length)}</strong></div><div className="evidence-row"><span>First detected</span><strong>{String(campaign.first_seen || 'Unknown')}</strong></div><div className="evidence-row"><span>Last detected</span><strong>{String(campaign.last_seen || 'Unknown')}</strong></div><div className="evidence-note">Only correlation metadata is shown here. Full email content remains in each organization workspace.</div></aside></section>
      <section className="data-section campaign-investigation"><h3>Investigation notes</h3><p>{String(campaign.summary || 'Review shared fingerprint similarity, timing, and organization membership before escalating this campaign.')}</p><table className="central-table"><thead><tr><th>Organization</th><th>Similarity</th><th>Correlation distance</th><th>Why related</th></tr></thead><tbody>{members.map((member, index) => <tr key={`${member.tenant_id}-row-${index}`}><td>{member.tenant_id || 'Unknown'}</td><td>{Math.round(Number(member.similarity || 0) * 100)}%</td><td>{member.correlation_distance ?? 'N/A'}</td><td>{(member.match_reasons || ['fingerprint similarity']).join(' · ')}</td></tr>)}</tbody></table></section>
    </> : <section className="empty-investigation">No campaign relationship data is currently available.</section>}
  </AppShell>;
}
