import { AppShell } from '../../components/AppShell';
import { fetchCentralCampaigns, fetchCentralOrganizations } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

export default async function TenantsPage() {
  const [orgs, campaigns] = await Promise.all([
    fetchCentralOrganizations(),
    fetchCentralCampaigns()
  ]);

  // Derive tenant activity from campaign members when org list is empty
  const tenantMap = new Map<string, { id: string; name: string; domains: string[]; campaigns: number }>();

  (Array.isArray(orgs) ? orgs : []).forEach((o) => {
    tenantMap.set(String(o.id), {
      id: String(o.id),
      name: o.name || `Org ${o.id}`,
      domains: Array.isArray(o.domains) ? o.domains : [],
      campaigns: 0
    });
  });

  campaigns.forEach((c) => {
    const members = Array.isArray(c.members) ? (c.members as Array<Record<string, unknown>>) : [];
    const seen = new Set<string>();
    members.forEach((m) => {
      const tid = String(m.tenant_id || m.organization || '');
      if (!tid || seen.has(tid)) return;
      seen.add(tid);
      if (!tenantMap.has(tid)) {
        tenantMap.set(tid, {
          id: tid,
          name: tid,
          domains: m.sender_domain ? [String(m.sender_domain)] : [],
          campaigns: 0
        });
      }
      const entry = tenantMap.get(tid)!;
      entry.campaigns += 1;
    });
  });

  const tenants = Array.from(tenantMap.values()).sort((a, b) => b.campaigns - a.campaigns);

  return (
    <AppShell
      title="Tenants / organizations"
      subtitle="Cross-tenant visibility (metadata only)"
      navItems={[...CENTRAL_NAV]}
    >
      <section className="art-section-heading">
        <div>
          <div className="soc-kicker">Federated view</div>
          <h2>Connected organizations</h2>
        </div>
      </section>

      {tenants.length === 0 ? (
        <div className="art-empty-state">
          No organization metadata available yet. Tenant identifiers will appear here once campaigns
          include member fingerprints.
        </div>
      ) : (
        <div className="campaign-list">
          {tenants.map((t) => (
            <div key={t.id} className="campaign-list-card" style={{ cursor: 'default' }}>
              <div className="campaign-list-head">
                <div>
                  <div className="campaign-list-kicker">ORGANIZATION</div>
                  <div className="campaign-list-id" style={{ fontSize: 16 }}>
                    {t.name}
                  </div>
                </div>
                <span className="campaign-status">{t.campaigns} campaigns</span>
              </div>
              <div className="campaign-list-stats">
                <div>
                  <strong>{t.id}</strong>
                  <span>Tenant ID</span>
                </div>
                <div>
                  <strong>{t.domains.length ? t.domains.join(', ') : '—'}</strong>
                  <span>Domains</span>
                </div>
                <div>
                  <strong>{t.campaigns}</strong>
                  <span>Linked campaigns</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
