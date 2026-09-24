import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

export default async function ReportsPage() {
  const { reports } = await fetchCentralReports();
  const list = Array.isArray(reports) ? reports : [];

  return (
    <AppShell
      title="Threat reports"
      subtitle="Suspicious email reports visible to central SOC"
      navItems={[...CENTRAL_NAV]}
    >
      <section className="art-section-heading">
        <div>
          <div className="soc-kicker">Evidence store</div>
          <h2>Suspicious reports</h2>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="art-empty-state">
          No suspicious reports available. Only high-signal reports are exposed to the central
          console; full message content remains in the college portal.
        </div>
      ) : (
        <div
          style={{
            background: '#0b1523',
            border: '1px solid #243b5b',
            borderRadius: 12,
            overflow: 'hidden'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#6e91ad', textAlign: 'left', background: '#0f1a28' }}>
                <th style={{ padding: '12px 16px' }}>Report ID</th>
                <th style={{ padding: '12px 16px' }}>Severity</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Created</th>
                <th style={{ padding: '12px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {list.map((report) => {
                const id = String(report.report_id || '');
                const sev = String(report.severity || 'review').toLowerCase();
                return (
                  <tr key={id} style={{ borderTop: '1px solid #1d344b' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'Consolas, monospace' }}>
                      {id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`severity-pill severity-${sev}`}>{sev}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#c5d8ef' }}>
                      {String(report.report_type || 'email')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#8aa4bf' }}>
                      {String(report.created_at || '—')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/reports/${encodeURIComponent(id)}`} className="art-inline-link">
                        Open ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
