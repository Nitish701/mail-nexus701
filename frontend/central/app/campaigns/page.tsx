import { AppShell } from '../../components/AppShell';
import { fetchCentralCampaigns } from '../../lib/api';

export default async function CentralCampaignsPage() {
  const campaigns = await fetchCentralCampaigns();

  return (
    <AppShell
      title="Central Security & Correlation SOC"
      subtitle="Cross-tenant view"
      navItems={[
        { label: 'SOC Overview', href: '/' },
        { label: 'Live Feed', href: '/live-feed' },
        { label: 'Campaigns', href: '/campaigns' },
        { label: 'Investigations', href: '/investigations' },
        { label: 'Threat Intelligence', href: '/threat-intelligence' },
        { label: 'Tenants', href: '/tenants' },
        { label: 'Reports', href: '/reports' },
        { label: 'System Health', href: '/system-health' }
      ]}
    >
      <section style={{ background: '#111827', borderRadius: 16, padding: 24, border: '1px solid #243b5b' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Cross-tenant campaigns</h2>
        {campaigns.length === 0 ? (
          <div style={{ color: '#9fb5d8', padding: '24px 0 8px' }}>No campaigns are currently available.</div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {campaigns.map((campaign) => {
              const severity = String(campaign.status || 'Unknown');
              const members = Array.isArray(campaign.members) ? campaign.members as Array<Record<string, unknown>> : [];
              return (
            <div key={String(campaign.campaign_id)} style={{ border: '1px solid #243b5b', borderRadius: 12, padding: 16, background: '#0b1221' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{String(campaign.campaign_id || 'Unnamed campaign')}</div>
                  <div style={{ color: '#9fb5d8', marginTop: 4 }}>{Number(campaign.tenant_count || 0)} organizations impacted</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: '#8ec5ff', fontWeight: 700 }}>{severity}</span>
                  <span style={{ color: '#8ec5ff', fontWeight: 700 }}>{Number(campaign.email_count || 0)} emails</span>
                </div>
              <div style={{ marginTop: 14, color: '#9fb5d8', fontSize: 13 }}>Relationship map: {members.length ? members.map((member) => `${String(member.tenant_id)} (${Math.round(Number(member.similarity || 0) * 100)}% similarity)`).join(' · ') : 'No member relationship data'}</div>
              </div>
            </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
