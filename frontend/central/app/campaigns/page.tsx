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

function getTopMatchReason(members: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();
  members.forEach((member) => {
    const reasons = Array.isArray(member.match_reasons)
      ? member.match_reasons.filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0)
      : [];
    new Set(reasons).forEach((reason) => counts.set(reason, (counts.get(reason) || 0) + 1));
  });
  const topReason = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return topReason || 'No match reason returned';
}

function getCampaignNarrative(campaign: Record<string, unknown>, members: Array<Record<string, unknown>>) {
  const tenantCount = Number(campaign.tenant_count || new Set(members.map((member) => String(member.tenant_id || 'unknown'))).size || 0);
  const messageCount = Number(campaign.email_count || members.length || 0);

  if (campaign.summary && String(campaign.summary).trim()) {
    return String(campaign.summary);
  }

  if (!members.length) {
    return 'No member evidence was returned for this campaign.';
  }

  return `This campaign groups ${messageCount} related messages across ${tenantCount} organizations. Review the member evidence to see which returned indicators link them.`;
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredCampaigns = campaigns.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const id = String(c.campaign_id || '').toLowerCase();
    const summary = String(c.summary || '').toLowerCase();
    const status = String(c.status || '').toLowerCase();
    return id.includes(q) || summary.includes(q) || status.includes(q);
  });

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
          <section className="page-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div className="soc-kicker">Correlation engine</div>
              <h2 className="page-section-title">{campaigns.length} active campaign clusters</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="soc-search-wrapper" style={{ maxWidth: 260 }}>
                <span className="soc-search-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="soc-search-input"
                  placeholder="Search campaign ID or pattern..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '7px 12px 7px 32px', fontSize: 12 }}
                />
              </div>
              <button type="button" className="btn-ghost" onClick={() => setView('graph')}>
                View relationship graph →
              </button>
            </div>
          </section>

          <div className="campaign-list">
            {filteredCampaigns.map((campaign) => {
              const members = Array.isArray(campaign.members)
                ? (campaign.members as Array<Record<string, unknown>>)
                : [];
              const campaignId = String(campaign.campaign_id || 'unknown');
              const similarities = members
                .map((member) => member.similarity)
                .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
              const avgSim = similarities.length
                ? Math.round((similarities.reduce((total, value) => total + value, 0) / similarities.length) * 100)
                : null;
              const tenants = new Set(
                members.map((m) => String(m.tenant_id || 'unknown'))
              );
              const narrative = getCampaignNarrative(campaign, members);
              const topMatchReason = getTopMatchReason(members);

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
                    <span className="campaign-status">{String(campaign.status || 'Unknown')}</span>
                  </div>
                  <div className="campaign-list-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                    <div>
                      <strong>{Number(campaign.email_count || members.length)}</strong>
                      <span>Related emails</span>
                    </div>
                    <div>
                      <strong>{Number(campaign.tenant_count || tenants.size)}</strong>
                      <span>Affected orgs</span>
                    </div>
                    <div>
                      <strong>{avgSim === null ? 'N/A' : `${avgSim}%`}</strong>
                      <span>Pattern match</span>
                    </div>
                    <div>
                      <strong>{formatDisplayDate(campaign.first_seen || campaign.created_at || '—')}</strong>
                      <span>First detected</span>
                    </div>
                    <div>
                      <strong>{formatDisplayDate(campaign.last_seen || '—')}</strong>
                      <span>Last seen</span>
                    </div>
                  </div>
                  <div className="campaign-list-summary">
                    <span>Top match reason</span>
                    {topMatchReason}
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