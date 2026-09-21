import { AppShell } from '../../components/AppShell';
import { fetchCollegeReportDetails, fetchCollegeReports } from '../../lib/api';

const navItems = [{ label: 'Dashboard', href: '/' }, { label: 'Emails', href: '/emails' }, { label: 'Threats', href: '/threats' }, { label: 'Campaigns', href: '/campaigns' }, { label: 'Reports', href: '/reports' }];

function JsonBlock({ value }: { value: unknown }) {
  return <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: '12px/1.5 Consolas, monospace', color: '#4d5d68' }}>{JSON.stringify(value, null, 2)}</pre>;
}

export default async function CollegeReportsPage() {
  const reports = await fetchCollegeReports();
  const details = await Promise.all(reports.map((report) => fetchCollegeReportDetails(report.report_id)));
  return <AppShell title="Investigation reports" subtitle="Structured intelligence" navItems={navItems}>
    <section className="data-section">
      <div className="section-heading"><div><h2>College reports</h2><div className="muted">Open a report to review the evidence collected by the live pipeline.</div></div></div>
      {reports.length === 0 ? <p className="muted">No reports are available for this college.</p> : <div style={{ display: 'grid', gap: 12 }}>{reports.map((report, index) => {
        const detail = details[index];
        const message = detail?.message as Record<string, unknown> | undefined;
        const risk = detail?.risk;
        const auth = detail?.authentication;
        const intelligence = { urls: detail?.urls, attachments: detail?.attachments, iocs: detail?.iocs, virustotal: detail?.virustotal };
        return <details key={report.report_id} style={{ border: '1px solid #d6e0e3', background: '#fff', padding: 16 }}>
          <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}><span><strong>{report.title}</strong><span className="muted" style={{ display: 'block', marginTop: 5, font: '12px Arial' }}>{report.report_id} · {report.created_at || 'Date unavailable'}</span></span><span className={`badge badge-${report.severity.toLowerCase()}`}>{report.severity}</span></summary>
          {detail ? <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
            <div className="stat-grid"><div className="stat-card"><label>Report ID</label><strong style={{ fontSize: 15 }}>{report.report_id}</strong></div><div className="stat-card"><label>Status</label><strong style={{ fontSize: 15 }}>ANALYZED</strong></div><div className="stat-card"><label>College</label><strong style={{ fontSize: 15 }}>Current college</strong></div></div>
            <div className="data-section"><h3>Email intelligence</h3><JsonBlock value={message} /></div>
            <div className="data-section"><h3>Threat intelligence</h3><JsonBlock value={intelligence} /></div>
            <div className="data-section"><h3>Authentication</h3><JsonBlock value={auth} /></div>
            <div className="data-section"><h3>Risk assessment</h3><JsonBlock value={risk} /></div>
          </div> : <p className="muted">Report details are temporarily unavailable.</p>}
        </details>;
      })}</div>}
    </section>
  </AppShell>;
}
