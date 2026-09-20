import { AppShell } from '../../components/AppShell';
import { fetchCollegeReportDetails, fetchCollegeReports } from '../../lib/api';

export default async function CollegeReportsPage() {
  const reports = await fetchCollegeReports();
  const reportDetails = await Promise.all(reports.map((report) => fetchCollegeReportDetails(report.report_id)));

  return (
    <AppShell
      title="Organization Security Portal"
      subtitle="Organization security"
      navItems={[
        { label: 'Dashboard', href: '/' },
        { label: 'Emails', href: '/emails' },
        { label: 'Threats', href: '/threats' },
        { label: 'Investigations', href: '/investigations' },
        { label: 'Reports', href: '/reports' },
        { label: 'Settings', href: '/settings' }
      ]}
    >
      <section style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #dfeaf6' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Security reports</h2>
        {reports.length === 0 ? (
          <div style={{ color: '#5a6f8a', padding: '24px 0 8px' }}>No organizational reports are currently available.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {reports.map((report, index) => {
              const detail = reportDetails[index];
              const detailSections: Array<[string, unknown]> = detail ? [
                ['Risk', detail.risk],
                ['Message', detail.message],
                ['Authentication', detail.authentication],
                ['Detection layers', detail.layers],
                ['Findings', detail.findings],
                ['URLs', detail.urls],
                ['Attachments', detail.attachments],
                ['VirusTotal', detail.virustotal],
                ['Fingerprint', detail.fingerprint],
                ['IOCs', detail.iocs],
                ['Advisory', detail.advisory]
              ] : [];
              return (
                <details key={report.report_id} style={{ border: '1px solid #dfeaf6', borderRadius: 12, padding: 16 }}>
                  <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span>
                      <strong style={{ fontSize: 18 }}>{report.title}</strong>
                      <span style={{ display: 'block', color: '#5a6f8a', marginTop: 4 }}>{report.report_id} • {report.created_at || 'Date unavailable'}</span>
                    </span>
                    <strong style={{ color: '#3c6bb3' }}>{report.severity}</strong>
                  </summary>
                  {detail ? (
                    <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        {detailSections.map(([label, value]) => (
                          <div key={label} style={{ border: '1px solid #edf2f8', borderRadius: 9, padding: 12 }}>
                            <div style={{ color: '#5a6f8a', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
                            <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: '12px/1.5 Consolas, monospace' }}>{JSON.stringify(value, null, 2)}</pre>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ color: '#5a6f8a', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Complete stored report</div>
                        <pre style={{ margin: 0, padding: 14, background: '#f8fbff', border: '1px solid #edf2f8', borderRadius: 9, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'auto', font: '12px/1.5 Consolas, monospace' }}>{JSON.stringify(detail, null, 2)}</pre>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#5a6f8a', marginTop: 14 }}>Full report details are unavailable from the backend.</div>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
