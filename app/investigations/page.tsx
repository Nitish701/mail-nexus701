import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralCampaigns, fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

export default async function InvestigationsPage() {
  const [campaigns, reportsRes] = await Promise.all([
    fetchCentralCampaigns(),
    fetchCentralReports()
  ]);
  const reports = Array.isArray(reportsRes.reports) ? reportsRes.reports : [];
  const highRisk = reports.filter((r) =>
    ['high', 'critical'].includes(String(r.severity || '').toLowerCase())
  );

  const queue = [
    ...campaigns.slice(0, 5).map((c) => ({
      id: String(c.campaign_id),
      kind: 'campaign' as const,
      title: `Investigate campaign ${c.campaign_id}`,
      detail: String(c.summary || `${Number(c.email_count || 0)} fingerprints · ${Number(c.tenant_count || 0)} orgs`),
      href: `/campaigns/${encodeURIComponent(String(c.campaign_id))}`,
      severity: 'high'
    })),
    ...highRisk.slice(0, 8).map((r) => ({
      id: String(r.report_id),
      kind: 'report' as const,
      title: `Review report ${r.report_id}`,
      detail: `${String(r.severity || 'unknown')} · ${String(r.created_at || '')}`,
      href: `/reports/${encodeURIComponent(String(r.report_id))}`,
      severity: String(r.severity || 'medium').toLowerCase()
    }))
  ];

  return (
    <AppShell
      title="Investigation queue"
      subtitle="Prioritized work items for central analysts"
      navItems={[...CENTRAL_NAV]}
    >
      <section className="art-section-heading">
        <div>
          <div className="soc-kicker">SOC workflow</div>
          <h2>Open investigations</h2>
        </div>
      </section>

      {queue.length === 0 ? (
        <div className="art-empty-state">
          No high-priority items right now. New campaigns and high-severity reports will appear
          here automatically.
        </div>
      ) : (
        <div className="campaign-list">
          {queue.map((item) => (
            <Link key={`${item.kind}-${item.id}`} href={item.href} className="campaign-list-card">
              <div className="campaign-list-head">
                <div>
                  <div className="campaign-list-kicker">
                    {item.kind === 'campaign' ? 'CAMPAIGN' : 'REPORT'}
                  </div>
                  <div className="campaign-list-id" style={{ fontSize: 16 }}>
                    {item.title}
                  </div>
                </div>
                <span className={`severity-pill severity-${item.severity}`}>
                  {item.severity.toUpperCase()}
                </span>
              </div>
              <div className="campaign-list-summary" style={{ marginTop: 12 }}>
                {item.detail}
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
