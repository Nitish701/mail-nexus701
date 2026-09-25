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
  meta?: string;
};

type GraphEdge = {
  from: string;
  to: string;
  weight: number;
};

function buildGraph(campaigns: Campaign[], selectedId?: string) {
  const focus =
    campaigns.find((c) => String(c.campaign_id) === selectedId) || campaigns[0];
  if (!focus) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[], focus: null as Campaign | null };

  const members = Array.isArray(focus.members)
    ? (focus.members as Member[]).slice(0, 10)
    : [];

  const W = 720;
  const H = 420;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.34;

  const nodes: GraphNode[] = [
    {
      id: `campaign:${String(focus.campaign_id)}`,
      label: String(focus.campaign_id || 'Campaign'),
      kind: 'campaign',
      x: cx,
      y: cy,
      meta: `${Number(focus.email_count || members.length)} fingerprints`
    }
  ];

  const edges: GraphEdge[] = [];
  const orgSeen = new Map<string, string>();

  members.forEach((m, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(members.length, 1) - Math.PI / 2;
    const emailId = `email:${String(m.fingerprint_id || m.sha256 || m.id || i)}`;
    const orgKey = String(m.tenant_id || m.organization || `org-${i}`);
    const sim = Number(m.similarity || 0);

    const ex = cx + Math.cos(angle) * radius;
    const ey = cy + Math.sin(angle) * radius;

    nodes.push({
      id: emailId,
      label: String(m.sender_domain || m.subject || `FP-${i + 1}`).slice(0, 22),
      kind: 'email',
      x: ex,
      y: ey,
      similarity: sim,
      meta: String(m.source_ip || '')
    });

    edges.push({
      from: nodes[0].id,
      to: emailId,
      weight: sim || 0.5
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
        meta: 'Organization'
      });
      edges.push({
        from: emailId,
        to: orgId,
        weight: 0.4
      });
    } else {
      edges.push({
        from: emailId,
        to: orgSeen.get(orgKey)!,
        weight: 0.35
      });
    }
  });

  return { nodes, edges, focus };
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

  const { nodes, edges, focus } = useMemo(
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

  const members = focus && Array.isArray(focus.members)
    ? (focus.members as Member[])
    : [];
  const avgSim = members.length
    ? Math.round(
        (members.reduce((t, m) => t + Number(m.similarity || 0), 0) / members.length) * 100
      )
    : 0;

  return (
    <div className="cg-layout">
      <div className="cg-canvas-wrap">
        <div className="cg-canvas-header">
          <div>
            <div className="soc-kicker">Correlation topology</div>
            <h3 className="cg-title">
              {focus ? String(focus.campaign_id) : 'Select a campaign'}
            </h3>
          </div>
          <div className="cg-legend">
            <span className="cg-leg cg-leg-campaign">Campaign</span>
            <span className="cg-leg cg-leg-email">Fingerprint</span>
            <span className="cg-leg cg-leg-org">Organization</span>
          </div>
        </div>

        <svg
          className="cg-svg"
          viewBox="0 0 720 420"
          role="img"
          aria-label="Campaign correlation graph"
        >
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

          <rect width="720" height="420" fill="url(#cg-bg)" />

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
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={(i + 1) * 70}
              x2={720}
              y2={(i + 1) * 70}
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
                stroke={
                  active
                    ? `rgba(100,180,255,${0.25 + e.weight * 0.45})`
                    : 'rgba(60,90,120,0.15)'
                }
                strokeWidth={1.2 + e.weight * 2.2}
                strokeLinecap="round"
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
                  fontSize={n.kind === 'campaign' ? 9 : 8}
                  fontWeight="700"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {n.kind === 'campaign' ? 'CAM' : n.kind === 'org' ? 'ORG' : 'FP'}
                </text>
                <text
                  x={n.x}
                  y={n.y + r + 14}
                  textAnchor="middle"
                  fill="#b8cce0"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {n.label.length > 16 ? n.label.slice(0, 14) + '…' : n.label}
                </text>
                {n.similarity != null && n.similarity > 0 && (
                  <text
                    x={n.x}
                    y={n.y + r + 26}
                    textAnchor="middle"
                    fill="#6ee7b7"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {Math.round(n.similarity * 100)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <aside className="cg-side">
        <div className="soc-kicker">Campaign selector</div>
        <div className="cg-selector">
          {campaigns.map((c) => {
            const id = String(c.campaign_id);
            const active = id === selectedId;
            return (
              <button
                key={id}
                type="button"
                className={`cg-select-btn ${active ? 'is-active' : ''}`}
                onClick={() => setSelectedId(id)}
              >
                <span className="cg-select-id">{id}</span>
                <span className="cg-select-meta">
                  {Number(c.email_count || 0)} FP · {Number(c.tenant_count || 0)} orgs
                </span>
              </button>
            );
          })}
        </div>

        {focus && (
          <div className="cg-stats">
            <div className="soc-kicker">Cluster metrics</div>
            <div className="cg-stat-row">
              <span>Fingerprints</span>
              <strong>{Number(focus.email_count || members.length)}</strong>
            </div>
            <div className="cg-stat-row">
              <span>Organizations</span>
              <strong>{Number(focus.tenant_count || 0)}</strong>
            </div>
            <div className="cg-stat-row">
              <span>Avg similarity</span>
              <strong>{avgSim}%</strong>
            </div>
            <Link
              href={`/campaigns/${encodeURIComponent(String(focus.campaign_id))}`}
              className="cg-detail-link"
            >
              Open full detail →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}