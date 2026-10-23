import { AppShell } from '../../components/AppShell';

const SETTINGS_SECTIONS = [
  {
    category: 'Node Identity',
    items: [
      { label: 'Portal profile', value: 'Institution Mail Security Node', description: 'Tenant-scoped threat intelligence & ingest monitoring' },
      { label: 'Data isolation', value: 'Campus-Restricted Scope', description: 'Full RFC822 bodies and recipient identities remain local to this college' },
      { label: 'Correlation federation', value: 'Enabled (PII-Redacted)', description: 'Hashes and infrastructure indicators contribute to cross-institution campaign alerts' }
    ]
  },
  {
    category: 'Ingestion Pipeline & Workers',
    items: [
      { label: 'Cloudflare Worker Webhook', value: 'Active (/webhooks/email)', description: 'Receiving forwarded RFC822 raw streams' },
      { label: 'Local Named Tunnel', value: 'cloudflared named tunnel (localhost:8000)', description: 'Tunnel config in cloudflared/config.yml' },
      { label: 'Analysis pipeline', value: 'Layers 1–4 (Auth, Heuristics, ML, YARA)', description: 'Deterministic heuristics + XGBoost classification' }
    ]
  },
  {
    category: 'Data Residency & Retention',
    items: [
      { label: 'Storage format', value: 'Persisted JSON / SQLite', description: 'Reports stored in data/reports/ with multi-format export capability' },
      { label: 'Report export formats', value: 'JSON, CSV, Markdown, HTML', description: 'Compliant with SIH evaluation reproducibility standards' }
    ]
  }
];

export default function CollegeSettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Node configuration & gateway status">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {SETTINGS_SECTIONS.map((section) => (
          <section key={section.category} className="data-section">
            <div className="section-title-wrap">
              <h2 className="section-title">{section.category}</h2>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {section.items.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '10px 12px',
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>
                      {item.label}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                      {item.description}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--accent)',
                      background: 'var(--accent-subtle)',
                      padding: '3px 8px',
                      borderRadius: '3px',
                      border: '1px solid var(--accent-border)'
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
