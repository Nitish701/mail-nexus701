'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CampaignGraph } from '../../components/CampaignGraph';
import { ViewToggle } from '../../components/ViewToggle';
import { CENTRAL_NAV } from '../../lib/nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function formatDisplayDate(value: unknown) {
  if (!value || String(value) === '—') return 'Not yet identified';
  const raw = String(value);
  if (raw.includes('T')) return raw.replace('T', ' ').slice(0, 16);
  return raw;
}

function getCampaignNarrative(campaign: Record<string, unknown>, members: Array<Record<string, unknown>>) {
  const tenantCount = Number(campaign.tenant_count || new Set(members.map((member) => String(member.tenant_id || member.organization || 'unknown'))).size || 0);
  const messageCount = Number(campaign.email_count || members.length || 0);

  if (campaign.summary && String(campaign.summary).trim()) {
    return String(campaign.summary);
  }

  if (!members.length) {
    return 'A correlated phishing activity cluster is forming across multiple organizations.';
  }

  return `This campaign connects ${tenantCount} organizations and ${messageCount} related messages with a strong similarity pattern, suggesting a coordinated phishing effort.`;
}

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
  const [campaigns, setCampaigns] = useState<Array<Record<string, unknown>>>([]);
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
      subtitle="Clearly grouped phishing activity across tenant organizations"
      navItems={[...CENTRAL_NAV]}
      actions={<ViewToggle value={view} onChange={setView} />}
    >
      {loading ? (
        <div className="art-empty-state">Loading campaigns…</div>
      ) : view === 'graph' ? (
        <CampaignGraph campaigns={campaigns} />
      ) : campaigns.length === 0 ? (
        <div className="art-empty-state">
          No campaigns detected yet. When similar phishing emails or malicious infrastructure appear in
          multiple tenants, they will appear here as a single campaign.
        </div>
      ) : (
        <>
          <section className="page-toolbar">
            <div>
              <div className="soc-kicker">Correlation engine</div>
              <h2 className="page-section-title">{campaigns.length} active campaign clusters</h2>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setView('graph')}>
              View relationship graph →
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
                    (members.reduce((t, m) => t + Number(m.similarity || 0), 0) / members.length) *
                      100
                  )
                : 0;
              const tenants = new Set(
                members.map((m) => String(m.tenant_id || m.organization || 'unknown'))
              );
              const narrative = getCampaignNarrative(campaign, members);

              return (
                <Link
                  key={campaignId}
                  href={`/campaigns/${encodeURIComponent(campaignId)}`}
                  className="campaign-list-card"
                >
                  <div className="campaign-list-head">
                    <div>
                      <div className="campaign-list-kicker">Campaign</div>
                      <div className="campaign-list-id">{campaignId}</div>
                    </div>
                    <span className="campaign-status">Active</span>
                  </div>
                  <div className="campaign-list-stats">
                    <div>
                      <strong>{Number(campaign.email_count || members.length)}</strong>
                      <span>Related emails</span>
                    </div>
                    <div>
                      <strong>{Number(campaign.tenant_count || tenants.size)}</strong>
                      <span>Affected orgs</span>
                    </div>
                    <div>
                      <strong>{avgSim}%</strong>
                      <span>Pattern match</span>
                    </div>
                    <div>
                      <strong>{formatDisplayDate(campaign.first_seen || campaign.created_at || '—')}</strong>
                      <span>First detected</span>
                    </div>
                  </div>
                  <div className="campaign-list-summary">
                    <span>What it looks like</span>
                    {narrative}
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