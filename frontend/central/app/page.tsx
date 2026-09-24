import { fetchCentralCampaigns, fetchCentralReports } from '../lib/api';
import Link from 'next/link';
import { AppShell } from '../components/AppShell';

const navItems = [
  { label: 'SOC Overview', href: '/' },
  { label: 'Live Feed', href: '/live-feed' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Investigations', href: '/investigations' },
  { label: 'Threat Intelligence', href: '/threat-intelligence' },
  { label: 'Tenants', href: '/tenants' },
  { label: 'Reports', href: '/reports' },
  { label: 'System Health', href: '/system-health' }
];

export default async function CentralHome() {
  const [reports, campaigns] = await Promise.all([fetchCentralReports(), fetchCentralCampaigns()]);
  const highRiskReports = reports.reports.filter((report) => ['high', 'critical'].includes(String(report.severity || '').toLowerCase()));
  const organizationCount = new Set(campaigns.flatMap((campaign) => Array.isArray(campaign.members) ? campaign.members.map((member) => String((member as Record<string, unknown>).tenant_id)) : [])).size;
  const latestCampaigns = campaigns.slice(0, 3);
  const criticalCount = reports.reports.filter((report) => String(report.severity || '').toLowerCase() === 'critical').length;
  const domains = new Set<string>();
  const sourceIps = new Set<string>();
  campaigns.forEach((campaign) => (Array.isArray(campaign.members) ? campaign.members : []).forEach((member) => {
    const item = member as Record<string, unknown>;
    if (item.sender_domain) domains.add(String(item.sender_domain));
    if (item.source_ip) sourceIps.add(String(item.source_ip));
  }));
  const graphMembers = latestCampaigns.flatMap((campaign) => Array.isArray(campaign.members) ? campaign.members as Array<Record<string, unknown>> : []).slice(0, 6);

  return (
    <AppShell title="Email Threat Intelligence Center" subtitle="Detect • Correlate • Investigate" navItems={navItems}>
        <section className="art-hero compact-hero">
          <div className="art-hero-copy"><div className="soc-kicker">Mail-Nexus / Central SOC</div><h2>EMAIL THREAT<br /><span>INTELLIGENCE CENTER</span></h2><p>Detect <b>•</b> Correlate <b>•</b> Investigate</p><div className="art-hero-actions"><Link href="/campaigns" className="art-primary-action">Open campaign center <span>↗</span></Link><Link href="/investigations" className="art-secondary-action">Investigation queue</Link></div></div>
          <div className="art-kpi-grid"><div className="art-kpi kpi-critical"><span>Critical threats</span><strong>{criticalCount}</strong><small>Immediate review</small></div><div className="art-kpi kpi-campaign"><span>Active campaigns</span><strong>{campaigns.length}</strong><small>Correlated clusters</small></div><div className="art-kpi kpi-org"><span>Organizations</span><strong>{organizationCount}</strong><small>Impacted</small></div><div className="art-kpi kpi-investigation"><span>Investigations</span><strong>{highRiskReports.length}</strong><small>High / critical queue</small></div></div>
        </section>

        <section className="art-section-heading"><div><div className="soc-kicker">Threat operations</div><h2>Actionable security events</h2></div><Link href="/investigations" className="art-inline-link">View investigations ↗</Link></section>
        <section className="art-queue-panel"><div className="art-queue-title"><h2>Investigation queue</h2><span className="severity-pill severity-high">{highRiskReports.length} open</span></div><div className="art-queue-list">{highRiskReports.slice(0, 4).map((report) => <Link key={String(report.report_id)} href={`/reports/${encodeURIComponent(String(report.report_id))}`} className="art-queue-item"><span className={`severity-dot severity-dot-${String(report.severity || 'high').toLowerCase()}`} /><div><strong>{String(report.title || 'Suspicious email')}</strong><small>{String(report.report_id)} · {String(report.severity || 'high')} risk</small></div><b>Investigate ↗</b></Link>)}{highRiskReports.length === 0 && <div className="art-empty-row">No high or critical investigations.</div>}</div></section>

        <section className="art-section-heading"><div><div className="soc-kicker">Priority one</div><h2>Active campaigns</h2></div><Link href="/campaigns" className="art-inline-link">View all campaigns ↗</Link></section>
        <section className="art-campaign-grid">
          {latestCampaigns.length === 0 ? <div className="soc-panel art-empty-campaign">No active campaigns are currently correlated.</div> : latestCampaigns.map((campaign) => { const members = Array.isArray(campaign.members) ? campaign.members as Array<Record<string, unknown>> : []; const campaignId = String(campaign.campaign_id || 'Unknown campaign'); const similarity = members.length ? Math.round((members.reduce((total, member) => total + Number(member.similarity || 0), 0) / members.length) * 100) : 0; return <Link key={campaignId} href={`/campaigns/${encodeURIComponent(campaignId)}`} className="art-campaign-card"><div className="art-campaign-top"><span className="art-campaign-label">CORRELATED CAMPAIGN</span><span className="severity-pill severity-high">ACTIVE</span></div><strong className="art-campaign-id">{campaignId}</strong><div className="art-campaign-summary">{String(campaign.summary || `${members.length} related email fingerprints correlated across connected organizations.`)}</div><div className="art-campaign-footer"><span>{Number(campaign.tenant_count || 0)} organizations</span><span>{Number(campaign.email_count || members.length)} fingerprints</span><b>{similarity}% match</b></div></Link>; })}
        </section>

        <section className="art-section-heading"><div><div className="soc-kicker">Network evidence</div><h2>Campaign correlation</h2></div><Link href="/campaign-graph" className="art-inline-link">Open full graph ↗</Link></section>
        <section className="art-correlation"><div className="art-graph-stage"><div className="art-graph-center"><span>CAMPAIGN</span><strong>{latestCampaigns[0] ? String(latestCampaigns[0].campaign_id) : 'WAITING'}</strong></div>{graphMembers.map((member, index) => <div key={`${String(member.tenant_id)}-${index}`} className={`art-graph-node graph-pos-${index % 6}`}><span>{index % 2 ? 'ORGANIZATION' : 'EMAIL'}</span><strong>{String(member.tenant_id || member.sender_domain || 'Related entity')}</strong><small>{Math.round(Number(member.similarity || 0) * 100)}% match</small></div>)}</div><aside className="art-intel-panel"><div className="soc-kicker">Threat intelligence</div><h3>Active indicators</h3><div className="art-intel-row"><span>Malicious domains</span><strong>{domains.size}</strong></div><div className="art-intel-row"><span>Source IPs</span><strong>{sourceIps.size}</strong></div><div className="art-intel-row"><span>Correlated fingerprints</span><strong>{latestCampaigns.reduce((total, campaign) => total + Number(campaign.email_count || 0), 0)}</strong></div><Link href="/threat-intelligence" className="art-intel-link">Explore intelligence ↗</Link></aside></section>
    </AppShell>
  );
}
