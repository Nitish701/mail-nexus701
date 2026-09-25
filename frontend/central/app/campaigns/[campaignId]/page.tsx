import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { fetchCentralCampaignDetail } from '../../../lib/api';
import { CENTRAL_NAV } from '../../../lib/nav';

type CampaignMember = { tenant_id?: string | number; similarity?: number; correlation_distance?: number; source_ip?: string; sender_domain?: string; observed_at?: string; match_reasons?: string[] };

export default async function CampaignDetailPage({ params }: { params: { campaignId: string } }) {
  const campaign = await fetchCentralCampaignDetail(params.campaignId);

  if (!campaign) {
    return (
      <AppShell title="Campaign detail" subtitle="No campaign found" navItems={[...CENTRAL_NAV]}>
        <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24, borderRadius: 16 }}>
          <h2 style={{ margin: 0 }}>Campaign not available</h2>
          <p style={{ color: '#9fb5d8', marginTop: 12 }}>No campaign record exists for this identifier yet.</p>
          <Link href="/campaigns" style={{ color: '#8ec5ff', fontWeight: 700 }}>Return to campaigns</Link>
        </section>
      </AppShell>
    );
  }

  const members = Array.isArray(campaign.members) ? (campaign.members as CampaignMember[]) : [];
  const tenantCount = Number(campaign.tenant_count || members.length || 0);
  const emailCount = Number(campaign.email_count || members.length || 0);
  const avgSimilarity = members.length
    ? Math.round((members.reduce((total, member) => total + Number(member.similarity || 0), 0) / members.length) * 100)
    : 0;
  const organizations = [...new Set(members.map((member) => String(member.tenant_id || 'Unknown')))].join(', ');
  const reasons = [...new Set(members.flatMap((member) => member.match_reasons || []))];
  const chartWidth = 760;
  const chartHeight = 230;
  const chartLeft = 48;
  const chartRight = 22;
  const chartTop = 20;
  const chartBottom = 42;
  const chartInnerWidth = chartWidth - chartLeft - chartRight;
  const chartInnerHeight = chartHeight - chartTop - chartBottom;
  const chartPoints = members.map((member, index) => {
    const value = Math.round(Number(member.similarity || 0) * 100);
    const x = chartLeft + (members.length > 1 ? (index / (members.length - 1)) * chartInnerWidth : chartInnerWidth / 2);
    const y = chartTop + ((100 - value) / 100) * chartInnerHeight;
    return { x, y, value, label: `${member.tenant_id || 'Unknown tenant'} · ${member.observed_at || 'Unknown time'}` };
  });
  const similarityPath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const areaPath = chartPoints.length ? `${similarityPath} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} ${chartTop + chartInnerHeight} L ${chartPoints[0].x.toFixed(1)} ${chartTop + chartInnerHeight} Z` : '';
  const thresholdY = chartTop + ((100 - 80) / 100) * chartInnerHeight;

  return (
    <AppShell title="Campaign detail" subtitle="Cross-tenant evidence" navItems={[...CENTRAL_NAV]}>
      <div style={{ display: 'grid', gap: 18 }}>
        <Link href="/campaigns" style={{ color: '#8ec5ff', fontWeight: 700 }}>Back to campaigns</Link>

        <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#8ec5ff', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>Campaign ID</div>
              <h2 style={{ margin: '8px 0 0', fontSize: 28 }}>{String(campaign.campaign_id || 'Unknown campaign')}</h2>
            </div>
            <div style={{ background: '#172554', border: '1px solid #36558a', borderRadius: 999, padding: '10px 16px', color: '#dbeafe', fontWeight: 700 }}>
              {String(campaign.status || 'ACTIVE')}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 20 }}>
            <div style={{ background: '#0b1221', borderRadius: 12, border: '1px solid #243b5b', padding: 16 }}>
              <div style={{ color: '#9fb5d8', fontSize: 12, textTransform: 'uppercase' }}>Organizations</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{tenantCount}</div>
            </div>
            <div style={{ background: '#0b1221', borderRadius: 12, border: '1px solid #243b5b', padding: 16 }}>
              <div style={{ color: '#9fb5d8', fontSize: 12, textTransform: 'uppercase' }}>Emails</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{emailCount}</div>
            </div>
            <div style={{ background: '#0b1221', borderRadius: 12, border: '1px solid #243b5b', padding: 16 }}>
              <div style={{ color: '#9fb5d8', fontSize: 12, textTransform: 'uppercase' }}>Avg. similarity</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{avgSimilarity}%</div>
            </div>
            <div style={{ background: '#0b1221', borderRadius: 12, border: '1px solid #243b5b', padding: 16 }}>
              <div style={{ color: '#9fb5d8', fontSize: 12, textTransform: 'uppercase' }}>First seen</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{String(campaign.first_seen || 'Unknown')}</div>
            </div>
          </div>
        </section>

        <section className="soc-chart-panel">
          <div className="soc-chart-header"><div><h3>Correlation strength over time</h3><p>Similarity for each escalated email in this campaign.</p></div><div className="soc-chart-legend"><span><i className="legend-similarity" />Similarity</span><span><i className="legend-threshold" />Review threshold</span></div></div>
          {chartPoints.length ? <div className="soc-chart-wrap"><svg className="soc-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Campaign correlation strength chart">
            {[0, 25, 50, 75, 100].map((value) => { const y = chartTop + ((100 - value) / 100) * chartInnerHeight; return <g key={value}><line x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} className="chart-grid" /><text x={chartLeft - 10} y={y + 4} textAnchor="end" className="chart-axis-label">{value}%</text></g>; })}
            <line x1={chartLeft} x2={chartWidth - chartRight} y1={thresholdY} y2={thresholdY} className="chart-threshold" />
            <path d={areaPath} className="chart-area" />
            <path d={similarityPath} className="chart-line" />
            {chartPoints.map((point, index) => <g key={`${point.label}-${index}`} className="chart-point"><circle cx={point.x} cy={point.y} r="5" /><title>{`${point.label}: ${point.value}% similarity`}</title></g>)}
            <line x1={chartLeft} x2={chartWidth - chartRight} y1={chartTop + chartInnerHeight} y2={chartTop + chartInnerHeight} className="chart-axis" />
            <text x={chartLeft} y={chartHeight - 12} className="chart-axis-label">First observed</text><text x={chartWidth - chartRight} y={chartHeight - 12} textAnchor="end" className="chart-axis-label">Latest observed</text>
            <text x="14" y={chartTop + chartInnerHeight / 2} transform={`rotate(-90 14 ${chartTop + chartInnerHeight / 2})`} className="chart-axis-label">Similarity</text>
          </svg></div> : <div className="soc-chart-empty">No correlation observations are available.</div>}
        </section>

        <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24, borderRadius: 16 }}>
          <h3 style={{ margin: '0 0 16px', color: '#8ec5ff', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Investigation report</h3>
          <div style={{ display: 'grid', gap: 10, color: '#dbeafe', lineHeight: 1.6 }}>
            <div><strong>What happened:</strong> Related messages were detected across {tenantCount} organizations.</div>
            <div><strong>Why they are linked:</strong> {reasons.length ? reasons.join(', ') : 'Fingerprint similarity and delivery timing.'}</div>
            <div><strong>Organizations:</strong> {organizations || 'Unavailable'}</div>
            <div><strong>Time window:</strong> {String(campaign.first_seen || 'Unknown')} to {String(campaign.last_seen || 'Unknown')}</div>
            <div><strong>Assessment:</strong> {String(campaign.summary || 'Review the evidence below before taking action.')}</div>
          </div>
        </section>

        <section style={{ background: '#111827', border: '1px solid #243b5b', padding: 24, borderRadius: 16 }}>
          <h3 style={{ margin: '0 0 18px', color: '#8ec5ff', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Evidence matrix</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {members.length === 0 ? (
              <div style={{ color: '#9fb5d8' }}>No member evidence is currently attached to this campaign.</div>
            ) : members.map((member, index) => (
              <div key={`${member.tenant_id ?? 'tenant'}-${index}`} className="evidence-gauge-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{String(member.tenant_id || 'Unknown tenant')}</div>
                  <div className="similarity-gauge" style={{ background: `conic-gradient(#63c6ff ${Math.min(100, Math.max(0, Math.round(Number(member.similarity || 0) * 100)))}%, #20364f 0)` }}><div><strong>{Math.round(Number(member.similarity || 0) * 100)}%</strong><span>match</span></div></div>
                </div>
                <div style={{ marginTop: 8, color: '#9fb5d8', fontSize: 13 }}>
                  <div>Correlation distance: {member.correlation_distance ?? 'N/A'} · Observed: {member.observed_at || 'Unknown'}</div>
                  <div style={{ marginTop: 5 }}>Evidence: {(member.match_reasons || ['fingerprint similarity']).join(' · ')}</div>
                  <div style={{ marginTop: 5 }}>Sender domain: {member.sender_domain || 'Unavailable'} · Source infrastructure: {member.source_ip || 'Unavailable'}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}