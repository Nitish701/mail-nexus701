import { AppShell } from '../../components/AppShell';
import { fetchCentralCampaigns } from '../../lib/api';
import Link from 'next/link';

export default async function CentralCampaignsPage() {
  const campaigns = await fetchCentralCampaigns();

  const safeCampaigns = Array.isArray(campaigns) ? campaigns.filter((campaign) => campaign && typeof campaign === 'object') : [];

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
        {safeCampaigns.length === 0 ? (
          <div style={{ color: '#9fb5d8', padding: '24px 0 8px' }}>No campaigns are currently available.</div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {safeCampaigns.map((campaign) => {
              const status = String(campaign.status || 'ACTIVE');
              const members = Array.isArray(campaign.members) ? campaign.members as Array<Record<string, unknown>> : [];
              const campaignId = String(campaign.campaign_id || 'unknown-campaign');
              const tenantCount = Number(campaign.tenant_count || new Set(members.map((member) => String(member.tenant_id))).size || 0);
              const emailCount = Number(campaign.email_count || members.length || 0);
              const similarities = members.map((member) => Number(member.similarity || 0)).filter((value) => Number.isFinite(value));
              const averageSimilarity = similarities.length ? Math.round((similarities.reduce((total, value) => total + value, 0) / similarities.length) * 100) : 0;
              const summary = String(campaign.summary || `Correlated campaign spanning ${tenantCount} tenant(s) and ${emailCount} email fingerprint(s). Average similarity ${averageSimilarity}%.`);
              return (
                <Link key={campaignId} href={`/campaigns/${encodeURIComponent(campaignId)}`} className="campaign-list-card">
                  <div className="campaign-list-head">
                    <div><div className="campaign-list-kicker">Campaign</div><div className="campaign-list-id">{campaignId}</div></div>
                    <span className="campaign-status">{status}</span>
                  </div>
                  <div className="campaign-list-stats"><div><strong>{tenantCount}</strong><span>Organizations</span></div><div><strong>{emailCount}</strong><span>Email fingerprints</span></div><div><strong>{String(campaign.first_seen || 'Unknown')}</strong><span>First seen</span></div><div><strong>{String(campaign.last_seen || 'Unknown')}</strong><span>Last seen</span></div></div>
                  <div className="campaign-list-summary"><span>Assessment</span>{summary}</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
