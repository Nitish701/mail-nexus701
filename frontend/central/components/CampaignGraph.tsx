'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Member = Record<string, unknown>;
type Campaign = Record<string, unknown>;

type GraphNode = {
  id: string;
  label: string;
  kind: 'campaign' | 'org' | 'email';
  x: number;
  y: number;
  similarity?: number;
  sequence?: number;
  meta?: string;
  details?: string;
};

type GraphEdge = {
  from: string;
  to: string;
  weight?: number;
};

function memberSimilarity(member: Member) {
  if (member.similarity === null || member.similarity === undefined || member.similarity === '') return null;
  const similarity = Number(member.similarity);
  return Number.isFinite(similarity) ? Math.min(1, Math.max(0, similarity)) : null;
}

function getMatchReasons(member: Member) {
  return Array.isArray(member.match_reasons)
    ? member.match_reasons.filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0)
    : [];
}

function formatObservedAt(value: unknown) {
  if (!value) return 'Unknown time';
  const raw = String(value);
  return raw.includes('T') ? raw.replace('T', ' ').slice(0, 16) : raw;
}

function getMostCommonReasons(members: Member[]) {
  const counts = new Map<string, number>();
  members.forEach((member) => {
    new Set(getMatchReasons(member)).forEach((reason) => counts.set(reason, (counts.get(reason) || 0) + 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function buildGraph(campaigns: Campaign[], selectedId?: string) {
  const focus =
    campaigns.find((c) => String(c.campaign_id) === selectedId) || campaigns[0];
  if (!focus) return {
    nodes: [] as GraphNode[],
    edges: [] as GraphEdge[],
    focus: null as Campaign | null,
    allMembers: [] as Member[]
  };

  const allMembers = Array.isArray(focus.members) ? (focus.members as Member[]) : [];
  const members = allMembers
    .map((member, index) => ({ member, index, observedAt: Date.parse(String(member.observed_at || '')) }))
    .sort((a, b) => {
      if (Number.isNaN(a.observedAt)) return Number.isNaN(b.observedAt) ? a.index - b.index : 1;
      if (Number.isNaN(b.observedAt)) return -1;
      return a.observedAt - b.observedAt || a.index - b.index;
    })
    .slice(0, 10)
    .map(({ member }) => member);

  const W = 720;
  const H = 520;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.22;

  const nodes: GraphNode[] = [
    {
      id: `campaign:${String(focus.campaign_id)}`,
      label: 'Campaign group',
      kind: 'campaign',
      x: cx,
      y: cy,
      meta: `${Number(focus.email_count || members.length)} related emails`,
      details: `Campaign ${String(focus.campaign_id || 'unknown')}`
    }
  ];

  const edges: GraphEdge[] = [];
  const orgSeen = new Map<string, string>();

  members.forEach((m, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(members.length, 1) - Math.PI / 2;
    const emailId = `email:${String(m.tenant_id || 'tenant')}:${String(m.observed_at || i)}:${i}`;
    const orgKey = String(m.tenant_id || `org-${i}`);
    const sim = memberSimilarity(m);

    const ex = cx + Math.cos(angle) * radius;
    const ey = cy + Math.sin(angle) * radius;

    nodes.push({
      id: emailId,
      label: String(m.sender_domain || m.source_ip || `Related email ${i + 1}`).slice(0, 22),
      kind: 'email',
      x: ex,
      y: ey,
      similarity: sim ?? undefined,
      sequence: i + 1,
      meta: String(m.source_ip || ''),
      details: [
        `Related email: ${String(m.sender_domain || m.source_ip || `Email ${i + 1}`)}`,
        `Organization: ${orgKey}`,
        sim !== null ? `Pattern similarity: ${Math.round(sim * 100)}%` : '',
        `Observed: ${formatObservedAt(m.observed_at)}`,
        getMatchReasons(m).length ? `Match reasons: ${getMatchReasons(m).join(', ')}` : ''
      ].filter(Boolean).join(' · ')
    });

    edges.push({
      from: nodes[0].id,
      to: emailId,
      weight: sim ?? undefined
    });

    if (!orgSeen.has(orgKey)) {
      const ox = cx + Math.cos(angle) * (radius * 1.55);
      const oy = cy + Math.sin(angle) * (radius * 1.55);
      const orgId = `org:${orgKey}`;
      orgSeen.set(orgKey, orgId);
      nodes.push({
        id: orgId,
        label: orgKey.slice(0, 18),
        kind: 'org',
        x: ox,
        y: oy,
        meta: 'Affected organization',
        details: `Affected organization: ${orgKey}`
      });
      edges.push({
        from: emailId,
        to: orgId
      });
    } else {
      edges.push({
        from: emailId,
        to: orgSeen.get(orgKey)!
      });
    }
  });

  return { nodes, edges, focus, allMembers };
}

export function CampaignGraph({
  campaigns,
  initialCampaignId
}: {
  campaigns: Campaign[];
  initialCampaignId?: string;
}) {
  const [selectedId, setSelectedId] = useState(
    initialCampaignId || (campaigns[0] ? String(campaigns[0].campaign_id) : '')
  );
  const [hoverId, setHoverId] = useState<string | null>(null);

  const { nodes, edges, focus, allMembers } = useMemo(
    () => buildGraph(campaigns, selectedId),
    [campaigns, selectedId]
  );

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  if (campaigns.length === 0) {
    return (
      <div className="art-empty-state">
        No campaign data available to render a correlation graph.
      </div>
    );
  }

  const members = allMembers;
  const rankedMembers = [...members].sort((a, b) => (memberSimilarity(b) ?? -1) - (memberSimilarity(a) ?? -1));
  const commonReasons = getMostCommonReasons(members);
  const similarityValues = members.map(memberSimilarity).filter((value): value is number => value !== null);
  const avgSim = similarityValues.length
    ? Math.round((similarityValues.reduce((total, value) => total + value, 0) / similarityValues.length) * 100)
    : null;
  const organizationCount = new Set(members.map((member) => String(member.tenant_id || 'unknown'))).size;

  return (
    <div className="cg-layout">
      <div className="cg-canvas-wrap">
        <div className="cg-canvas-header">
          <div>
            <div className="soc-kicker">Campaign connections</div>
            <h3 className="cg-title">
              {focus ? String(focus.campaign_id) : 'Select a campaign'}
            </h3>
            <p className="cg-intro">See which email patterns are grouped together and which organizations received them.</p>
          </div>
          <div className="cg-legend">
            <span className="cg-leg cg-leg-campaign">Campaign group</span>
            <span className="cg-leg cg-leg-email">Related email</span>
            <span className="cg-leg cg-leg-org">Affected organization</span>
          </div>
        </div>

        <div className="cg-explainer">
          <span><b className="cg-node-key">C</b> Campaign group</span>
          <span><b className="cg-node-key">E</b> Related email</span>
          <span><b className="cg-node-key">O</b> Affected organization</span>
          <span><i className="cg-line-key cg-line-email" />Campaign-to-email: line weight represents returned similarity.</span>
          <span>Graph email nodes are arranged by observed time, earliest first.</span>
          <span><i className="cg-line-key cg-line-org" />Email-to-organization line: shows where that email was observed.</span>
        </div>

        <svg
          className="cg-svg"
          viewBox="0 0 720 520"
          role="img"
          aria-label="Campaign connections graph. The center is the campaign, surrounding nodes are related emails and affected organizations."
        >
          <title>How this campaign connects emails and organizations</title>
          <desc>Brighter, thicker blue lines indicate a stronger email pattern match to the campaign. Green lines connect an email to the organization where it was observed.</desc>
          <defs>
            <radialGradient id="cg-bg" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="rgba(56,130,210,0.18)" />
              <stop offset="100%" stopColor="rgba(8,14,24,0)" />
            </radialGradient>
            <filter id="cg-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width="720" height="520" fill="url(#cg-bg)" />

          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={(i + 1) * 80}
              y1={0}
              x2={(i + 1) * 80}
              y2={420}
              stroke="rgba(60,90,130,0.12)"
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={(i + 1) * 65}
              x2={720}
              y2={(i + 1) * 65}
              stroke="rgba(60,90,130,0.12)"
              strokeWidth="1"
            />
          ))}

          {edges.map((e, i) => {
            const a = nodeMap.get(e.from);
            const b = nodeMap.get(e.to);
            if (!a || !b) return null;
            const active = hoverId === e.from || hoverId === e.to || hoverId === null;
            return (
              <line
                key={`e-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active
                  ? a.kind === 'email' && b.kind === 'org'
                    ? 'rgba(79,212,168,0.72)'
                    : `rgba(100,180,255,${0.25 + (e.weight ?? 0) * 0.45})`
                  : 'rgba(60,90,120,0.15)'}
                strokeWidth={a.kind === 'email' && b.kind === 'org' ? 1.5 : 1 + (e.weight ?? 0) * 2.2}
                strokeLinecap="round"
                strokeDasharray={a.kind === 'campaign' && b.kind === 'email' && e.weight == null ? '4 4' : undefined}
              />
            );
          })}

          {nodes.map((n) => {
            const isHover = hoverId === n.id;
            const r = n.kind === 'campaign' ? 28 : n.kind === 'org' ? 18 : 16;
            const fill =
              n.kind === 'campaign' ? '#1a4a7a' : n.kind === 'org' ? '#1a3d3a' : '#1e3558';
            const stroke =
              n.kind === 'campaign' ? '#6ec0ff' : n.kind === 'org' ? '#4fd4a8' : '#7aa8e0';
            return (
              <g
                key={n.id}
                className="cg-node"
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{ cursor: 'default' }}
              >
                <title>{n.details || n.label}</title>
                {n.kind === 'campaign' && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r + 10}
                    fill="none"
                    stroke="rgba(110,192,255,0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from={`0 ${n.x} ${n.y}`}
                      to={`360 ${n.x} ${n.y}`}
                      dur="28s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isHover ? 2.5 : 1.5}
                  filter={n.kind === 'campaign' ? 'url(#cg-glow)' : undefined}
                  opacity={hoverId && !isHover ? 0.55 : 1}
                />
                <text
                  x={n.x}
                  y={n.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#eef6ff"
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {n.kind === 'campaign' ? 'C' : n.kind === 'org' ? 'O' : 'E'}
                </text>
                {n.kind === 'email' && n.sequence != null && (
                  <text
                    x={n.x}
                    y={n.y - r - 5}
                    textAnchor="middle"
                    fill="#9aacc2"
                    fontSize="8"
                    fontWeight="700"
                  >
                    {`#${n.sequence}`}
                  </text>
                )}
                <text
                  x={n.x}
                  y={n.y + r + 13}
                  textAnchor="middle"
                  fill="#b8cce0"
                  fontSize="8"
                  fontWeight="600"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {n.label.length > 12 ? n.label.slice(0, 11) + '…' : n.label}
                </text>
                {n.similarity != null && (
                  <text
                    x={n.x}
                    y={n.y + r + 25}
                    textAnchor="middle"
                    fill="#6ee7b7"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {Math.round(n.similarity * 100)}% match
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="cg-explainer" style={{ display: 'block' }}>
          <strong>Linked mainly by:</strong>{' '}
          {commonReasons.length
            ? commonReasons.slice(0, 3).map(([reason]) => reason).join(' · ')
            : 'No match reasons were returned for these members.'}
          {members.length > 10 && (
            <p className="cg-limit-note" style={{ color: '#f5c66d' }}>
              Graph truncated to 10 of {members.length} members for readability. Open campaign evidence to review the full set.
            </p>
          )}
        </div>
      </div>

      <aside className="cg-side">
        <div className="soc-kicker">Choose a campaign</div>
        <p className="cg-side-intro">Select a campaign to update the connection map and summary.</p>
        <div className="cg-selector">
          {campaigns.map((c) => {
            const id = String(c.campaign_id);
            const active = id === selectedId;
            return (
              <button
                key={id}
                type="button"
                className={`cg-select-btn ${active ? 'is-active' : ''}`}
                title={`Campaign ${id}`}
                onClick={() => setSelectedId(id)}
                aria-pressed={active}
              >
                <span className="cg-select-id">Campaign {id}</span>
                <span className="cg-select-meta">
                  {Number(c.email_count || (Array.isArray(c.members) ? c.members.length : 0))} related emails · {Number(c.tenant_count || 0)} organizations
                </span>
              </button>
            );
          })}
        </div>

        {focus && (
          <div className="cg-stats">
            <div className="soc-kicker">Selected campaign</div>
            <div className="cg-stat-row">
              <span>Related emails</span>
              <strong>{Number(focus.email_count || members.length)}</strong>
            </div>
            <div className="cg-stat-row">
              <span>Affected organizations</span>
              <strong>{Number(focus.tenant_count || organizationCount)}</strong>
            </div>
            <div className="cg-stat-row">
              <span>Average pattern match</span>
              <strong>{avgSim === null ? 'N/A' : `${avgSim}%`}</strong>
            </div>
            <section className="cg-breakdown" aria-label="Correlation breakdown" style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #1e3148' }}>
              <h4 style={{ margin: '0 0 10px', color: '#dbeafe', fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase' }}>Correlation breakdown</h4>
              {rankedMembers.length ? (
                <ol className="cg-member-list" style={{ display: 'grid', gap: 8, maxHeight: 380, margin: 0, padding: '0 4px 0 20px', overflowY: 'auto' }}>
                  {rankedMembers.map((member, index) => {
                    const similarity = memberSimilarity(member);
                    const strongest = index === 0 && similarity !== null;
                    return (
                      <li key={`${String(member.tenant_id || 'tenant')}-${String(member.observed_at || index)}-${index}`} style={{ padding: 10, color: '#9aacc2', background: '#101c2c', border: `1px solid ${strongest ? '#4a8cc8' : '#243850'}`, borderRadius: 8, fontSize: 10, lineHeight: 1.5, boxShadow: strongest ? 'inset 2px 0 #6ec0ff' : undefined }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#eaf4ff' }}>
                          <strong>{strongest ? 'Strongest match · ' : ''}{String(member.tenant_id || 'Unknown organization')}</strong>
                          <span style={{ flex: '0 0 auto', color: '#7bd3ff', fontWeight: 800 }}>{similarity === null ? 'Similarity unavailable' : `${Math.round(similarity * 100)}%`}</span>
                        </div>
                        <div style={{ marginTop: 4, overflowWrap: 'anywhere' }}>Reasons: {getMatchReasons(member).join(' · ') || 'Not returned'}</div>
                        <div style={{ marginTop: 4, overflowWrap: 'anywhere' }}>Source IP: {String(member.source_ip || 'Unavailable')} · Sender domain: {String(member.sender_domain || 'Unavailable')}</div>
                        <div style={{ marginTop: 4 }}>Observed: {formatObservedAt(member.observed_at)}</div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p style={{ color: '#9aacc2', fontSize: 11 }}>No member evidence was returned.</p>
              )}
            </section>
            <Link
              href={`/campaigns/${encodeURIComponent(String(focus.campaign_id))}`}
              className="cg-detail-link"
            >
              View campaign evidence →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}