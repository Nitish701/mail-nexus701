import { AppShell } from '../../components/AppShell';
import { fetchCollegeCampaigns } from '../../lib/api';

const navItems = [{ label: 'Dashboard', href: '/' }, { label: 'Emails', href: '/emails' }, { label: 'Threats', href: '/threats' }, { label: 'Campaigns', href: '/campaigns' }, { label: 'Reports', href: '/reports' }];

export default async function CollegeCampaignsPage() {
  const campaigns = await fetchCollegeCampaigns();
  return <AppShell title="Campaigns" subtitle="Related activity" navItems={navItems}>
    <section className="data-section"><div className="section-heading"><div><h2>Detected campaigns</h2><div className="muted">Campaigns returned by the existing correlation API.</div></div></div>
      {campaigns.length === 0 ? <p className="muted">No campaigns detected for this college.</p> : <table className="data-table"><thead><tr><th>Campaign</th><th>Status</th><th>First detected</th><th>Last detected</th><th>Emails</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={String(campaign.campaign_id)}><td>{String(campaign.campaign_id)}</td><td>{String(campaign.status || 'Detected')}</td><td>{String(campaign.first_seen || 'Unknown')}</td><td>{String(campaign.last_seen || 'Unknown')}</td><td>{String(campaign.email_count || 0)}</td></tr>)}</tbody></table>}
    </section>
  </AppShell>;
}
