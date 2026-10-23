'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { RequestError } from '../../components/RequestError';
import { CampaignGraph } from '../../components/CampaignGraph';
import { ViewToggle } from '../../components/ViewToggle';
import { fetchCentralCampaigns } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

function formatDisplayDate(value: unknown) {
  if (!value || String(value) === '—') return 'Time unavailable';
  const raw = String(value);
  if (raw.includes('T')) return raw.replace('T', ' ').slice(0, 16);
  return raw;
}

function getTopMatchReason(members: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();
  members.forEach((member) => {
    const reasons = Array.isArray(member.match_reasons)
      ? member.match_reasons.filter(
          (reason): reason is string => typeof reason === 'string' && reason.trim().length > 0
        )
      : [];
    new Set(reasons).forEach((reason) => counts.set(reason, (counts.get(reason) || 0) + 1));
  });
  const topReason = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return topReason || 'No match reason recorded';
}

export default function CampaignsPage() {
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [campaigns, setCampaigns] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestError, setRequestError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRequestError('');
    (async () => {
      try {
        const data = await fetchCentralCampaigns();
        if (!cancelled) setCampaigns(data);
      } catch (error) {
        if (!cancelled) {
          setCampaigns([]);
          setRequestError(error instanceof Error ? error.message : 'Unable to load campaigns.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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
      title="Campaign Center"
      subtitle="Federated cross-campus phishing clusters"
      navItems={[...CENTRAL_NAV]}
      actions={<ViewToggle value={view} onChange={setView} />}
    >
      <header className="page-intro">
        <div>
          <h1>Threat campaigns</h1>
          <p>Inspect campaign records and correlations returned by the backend.</p>
        </div>
      </header>
      {requestError && (
        <RequestError
          message={`Unable to load campaigns: ${requestError}`}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}
      {/* Top Filter and Search Strip */}
      <div className="section-header">
        <div className="section-title-wrap">
          <h2 className="section-title">Active Threat Campaigns ({campaigns.length})</h2>
          <span className="section-desc">Correlated using Locality Sensitive Hashing (TLSH) and sender infrastructure signals.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            className="topbar-search-input"
            style={{ width: '220px' }}
            placeholder="Filter by campaign ID or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading correlated campaigns from database...</div>
      ) : view === 'graph' ? (
        <div className="data-section">
          <CampaignGraph campaigns={campaigns} />
        </div>
      ) : requestError ? null : campaigns.length === 0 ? (
        <div className="empty-state">
          No campaigns detected yet. When similar phishing emails or malicious infrastructure appear in
          multiple campuses, they will cluster here.
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="empty-state">No campaigns match your search.</div>
      ) : (
        <div className="campaign-grid">
          {filteredCampaigns.map((campaign) => {
            const members = Array.isArray(campaign.members)
              ? (campaign.members as Array<Record<string, unknown>>)
              : [];
            const campaignId = String(campaign.campaign_id || 'unknown');
            const similarities = members
              .map((member) => member.similarity)
              .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
            const avgSim = similarities.length
              ? `${Math.round((similarities.reduce((total, value) => total + value, 0) / similarities.length) * 100)}%`
              : '—';
            const tenants = new Set(members.map((m) => m.tenant_id).filter((tenant) => tenant !== null && tenant !== undefined).map(String));
            const topMatchReason = getTopMatchReason(members);

            return (
              <article key={campaignId} className="campaign-dense-card">
                <div className="campaign-card-head">
                  <div>
                    <div className="campaign-id-title">{campaignId}</div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                      Seen {formatDisplayDate(campaign.last_seen || campaign.first_seen)}
                    </small>
                  </div>
                  <span className="badge badge-high">
                    {String(campaign.status || 'Not provided').toUpperCase()}
                  </span>
                </div>

                <div className="campaign-meta-metrics">
                  <div className="campaign-metric-item">
                    <small>Messages</small>
                    <strong>{Number(campaign.email_count ?? members.length)}</strong>
                  </div>
                  <div className="campaign-metric-item">
                    <small>Campuses</small>
                    <strong>{typeof campaign.tenant_count === 'number' ? campaign.tenant_count : tenants.size || '—'}</strong>
                  </div>
                  <div className="campaign-metric-item">
                    <small>Similarity</small>
                    <strong>{avgSim}</strong>
                  </div>
                </div>

                <div className="campaign-match-signals">
                  <span className="signal-tag">{topMatchReason}</span>
                  <span className="signal-tag">{members.length} Correlated Nodes</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    First: {formatDisplayDate(campaign.first_seen)}
                  </span>
                  <Link
                    href={`/campaigns/${encodeURIComponent(campaignId)}`}
                    className="action-link"
                  >
                    Forensic evidence →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
