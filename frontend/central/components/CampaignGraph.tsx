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
  const H = 500;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.24;

  const nodes: GraphNode[] = [
    {
      id: `campaign:${String(focus.campaign_id)}`,
      label: 'Campaign Cluster',
      kind: 'campaign',
      x: cx,
      y: cy,
      meta: `${Number(focus.email_count ?? members.length)} emails`,
      details: `Campaign ${String(focus.campaign_id || 'cluster')}`
    }
  ];

  const edges: GraphEdge[] = [];
  const orgSeen = new Map<string, string>();

  members.forEach((m, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(members.length, 1) - Math.PI / 2;
    const tenantId = m.tenant_id === null || m.tenant_id === undefined || String(m.tenant_id).trim() === ''
      ? undefined
      : String(m.tenant_id);
    const emailId = `email:${tenantId || 'unassigned'}:${String(m.observed_at || i)}:${i}`;
    const sim = memberSimilarity(m);

    const emailNode: GraphNode = {
      id: emailId,
      label: String(m.subject || m.message_id || 'Email record').slice(0, 16),
      kind: 'email',
      x: Math.round(cx + Math.cos(angle) * radius),
      y: Math.round(cy + Math.sin(angle) * radius),
      similarity: sim ?? undefined,
      sequence: i + 1,
      meta: `Tenant: ${tenantId || 'Not provided'}`,
      details: `${m.subject || 'Threat mail'} (${sim !== null ? Math.round(sim * 100) : 'N/A'}% match)`
    };
    nodes.push(emailNode);

    edges.push({
      from: `campaign:${String(focus.campaign_id)}`,
      to: emailId,
      weight: sim ?? undefined
    });

    if (tenantId) {
      if (!orgSeen.has(tenantId)) {
        const orgAngle = angle + 0.28;
        const orgRadius = radius * 1.55;
        const orgId = `org:${tenantId}`;
        orgSeen.set(tenantId, orgId);
        nodes.push({
          id: orgId,
          label: tenantId,
          kind: 'org',
          x: Math.max(40, Math.min(W - 40, Math.round(cx + Math.cos(orgAngle) * orgRadius))),
          y: Math.max(40, Math.min(H - 40, Math.round(cy + Math.sin(orgAngle) * orgRadius))),
          meta: 'Organization',
          details: `Organization: ${tenantId}`
        });
      }
      edges.push({
        from: emailId,
        to: orgSeen.get(tenantId)!
      });
    }
  });

  return { nodes, edges, focus, allMembers };
}

export function CampaignGraph({ campaigns }: { campaigns: Campaign[] }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(
    campaigns[0] ? String(campaigns[0].campaign_id) : undefined
  );
  const [hoverId, setHoverId] = useState<string | null>(null);

  const { nodes, edges, focus, allMembers } = useMemo(
    () => buildGraph(campaigns, selectedId),
    [campaigns, selectedId]
  );

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const members = Array.isArray(focus?.members) ? (focus.members as Member[]) : [];
  const similarityValues = members
    .map(memberSimilarity)
    .filter((value): value is number => value !== null);
  const avgSim = similarityValues.length
    ? Math.round(
        (similarityValues.reduce((total, value) => total + value, 0) / similarityValues.length) * 100
      )
    : null;

  const organizationCount = new Set(
    members.map((member) => member.tenant_id)
      .filter((tenantId) => tenantId !== null && tenantId !== undefined && String(tenantId).trim() !== '')
      .map(String)
  ).size;

  const commonReasons = useMemo(() => getMostCommonReasons(members), [members]);

  const rankedMembers = useMemo(() => {
    return [...allMembers].sort((a, b) => {
      const simA = memberSimilarity(a) ?? -1;
      const simB = memberSimilarity(b) ?? -1;
      return simB - simA;
    });
  }, [allMembers]);

  return (
    <div className="campaign-graph-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '14px', alignItems: 'start' }}>
      <div className="cg-canvas" style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {focus ? String(focus.campaign_id) : 'Select a cluster'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Correlated email instances grouped around central structural TLSH cluster.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>● Campaign</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>● Inbound Email</span>
            <span style={{ color: 'var(--risk-low)', fontWeight: 600 }}>● Campus Node</span>
          </div>
        </div>

        <svg
          viewBox="0 0 720 500"
          role="img"
          aria-label="Campaign connection graph"
          style={{ width: '100%', height: 'auto', background: '#f8fafc', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
        >
          {/* Subtle grid lines */}
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={(i + 1) * 80}
              y1={0}
              x2={(i + 1) * 80}
              y2={500}
              stroke="#e5eaf0"
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={(i + 1) * 70}
              x2={720}
              y2={(i + 1) * 70}
              stroke="#e5eaf0"
              strokeWidth="1"
            />
          ))}

          {/* Edges */}
          {edges.map((e, i) => {
            const a = nodeMap.get(e.from);
            const b = nodeMap.get(e.to);
            if (!a || !b) return null;
            const active = hoverId === e.from || hoverId === e.to || hoverId === null;
            const isOrgEdge = (a.kind === 'email' && b.kind === 'org') || (a.kind === 'org' && b.kind === 'email');

            return (
              <line
                key={`e-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={
                  active
                    ? isOrgEdge
                      ? 'rgba(2, 122, 72, 0.4)'
                      : 'rgba(53, 120, 200, 0.4)'
                    : 'rgba(152, 162, 179, 0.2)'
                }
                strokeWidth={isOrgEdge ? 1 : 1.5}
                strokeDasharray={isOrgEdge ? '3 3' : undefined}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const isHover = hoverId === n.id;
            const r = n.kind === 'campaign' ? 24 : n.kind === 'org' ? 16 : 14;
            const fill =
              n.kind === 'campaign' ? '#edf4fc' : n.kind === 'org' ? '#ecfdf3' : '#ffffff';
            const stroke =
              n.kind === 'campaign' ? 'var(--accent)' : n.kind === 'org' ? 'var(--risk-low)' : 'var(--border-hover)';

            return (
              <g
                key={n.id}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isHover ? 2 : 1}
                  opacity={hoverId && !isHover ? 0.4 : 1}
                />
                <text
                  x={n.x}
                  y={n.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--text-primary)"
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="var(--font-sans)"
                >
                  {n.kind === 'campaign' ? 'C' : n.kind === 'org' ? 'O' : 'E'}
                </text>
                <text
                  x={n.x}
                  y={n.y + r + 11}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize="8"
                  fontWeight="600"
                  fontFamily="var(--font-sans)"
                >
                  {n.label.length > 12 ? n.label.slice(0, 11) + '…' : n.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <strong>Primary match signals:</strong>{' '}
          {commonReasons.length
            ? commonReasons.slice(0, 3).map(([reason]) => reason).join(' · ')
            : 'Fuzzy TLSH Hash Distance &le; 100'}
        </div>
      </div>

      {/* Side Cluster Selector */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="section-title" style={{ fontSize: '12px' }}>Choose Campaign Cluster</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
          {campaigns.map((c) => {
            const id = String(c.campaign_id);
            const active = id === selectedId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedId(id)}
                style={{
                  padding: '8px 10px',
                  background: active ? 'var(--accent-subtle)' : 'var(--bg-canvas)',
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '11px', fontFamily: 'var(--font-mono)', color: active ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {id}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {typeof c.email_count === 'number' ? c.email_count : '—'} emails · {typeof c.tenant_count === 'number' ? c.tenant_count : '—'} organizations
                </div>
              </button>
            );
          })}
        </div>

        {focus && (
          <div style={{ padding: '10px', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Cluster Metrics
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Related Messages:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{Number(focus.email_count || members.length)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Affected Campuses:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{Number(focus.tenant_count || organizationCount)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Pattern Match:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{avgSim ? `${avgSim}%` : 'N/A'}</strong>
            </div>

            <Link
              href={`/campaigns/${encodeURIComponent(String(focus.campaign_id))}`}
              className="btn btn-primary btn-sm"
              style={{ width: '100%', marginTop: '4px' }}
            >
              Open Cluster Evidence →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
