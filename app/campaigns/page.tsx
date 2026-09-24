'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CampaignGraph } from '../../components/CampaignGraph';
import { ViewToggle } from '../../components/ViewToggle';
import { CENTRAL_NAV } from '../../lib/nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function loadCampaigns() {
  try {
    const res = await fetch(`${API_URL}/api/developer2/campaigns`, { cache: 'no-store' });
    if (!res.ok) return [] as Array<Record<string, unknown>>;
    return (await res.json()) as Array<Record<string, unknown>>;
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

export default function CampaignsPage() {
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [campaigns, setCampaigns] = useState<Array<Record<string, unknown>>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadCampaigns();
      if (!cancelled) {
        setCampaigns(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell
      title="Campaign center"
      subtitle="Cross-tenant correlated phishing campaigns · list & graph"
      navItems={[...CENTRAL_NAV]}
      actions={<ViewToggle value={view} onChange={setView} />}
    >
      {loading ? (
        <div className="art-empty-state">Loading campaigns…</div>
      ) : view === 'graph' ? (
        <CampaignGraph campaigns={campaigns} />
      ) : campaigns.length === 0 ? (
        <div className="art-empty-state">
          No campaigns detected yet. When tenant fingerprints share TLSH / IOC similarity, they will
          appear here as correlated campaigns.
        </div>
      ) : (
        <>
          <section className="page-toolbar">
            <div>
              <div className="soc-kicker">Correlation engine</div>
              <h2 className="page-section-title">{campaigns.length} active campaigns</h2>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setView('graph')}>
              Open graph view →
            </button>
          </section>

          <div className="campaign-list">
            {campaigns.map((campaign) => {
              const members = Array.isArray(campaign.members)
                ? (campaign.members as Array<Record<string, unknown>>)
                : [];
              const campaignId = String(campaign.campaign_id || 'unknown');
              const avgSim = members.length
                ? Math.round(
                    (members.reduce((t, m) => t + Number(m.similarity || 0), 0) /
                      members.length) *
                      100
                  )
                : 0;
              const tenants = new Set(
                members.map((m) => String(m.tenant_id || m.organization || 'unknown'))
              );

              return (
                <Link
                  key={campaignId}
                  href={`/campaigns/${encodeURIComponent(campaignId)}`}
                  className="campaign-list-card"
                >
                  <div className="campaign-list-head">
                    <div>
                      <div className="campaign-list-kicker">CAMPAIGN ID</div>
                      <div className="campaign-list-id">{campaignId}</div>
                    </div>
                    <span className="campaign-status">ACTIVE</span>
                  </div>
                  <div className="campaign-list-stats">
                    <div>
                      <strong>{Number(campaign.email_count || members.length)}</strong>
                      <span>Fingerprints</span>
                    </div>
                    <div>
                      <strong>{Number(campaign.tenant_count || tenants.size)}</strong>
                      <span>Organizations</span>
                    </div>
                    <div>
                      <strong>{avgSim}%</strong>
                      <span>Avg similarity</span>
                    </div>
                    <div>
                      <strong>
                        {String(campaign.first_seen || campaign.created_at || '—')}
                      </strong>
                      <span>First seen</span>
                    </div>
                  </div>
                  <div className="campaign-list-summary">
                    <span>Summary</span>
                    {String(
                      campaign.summary ||
                        `Correlated cluster of ${members.length} fingerprints across ${tenants.size} organizations.`
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
