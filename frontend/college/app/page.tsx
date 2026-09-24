import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { fetchCollegeReports } from '../lib/api';

const appTitle = process.env.NEXT_PUBLIC_APP_NAME || 'Mail-Nexus Organization Security Portal';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Emails', href: '/emails' },
  { label: 'Threats', href: '/threats' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Reports', href: '/reports' }
];

function riskClass(value: string) {
  return `badge badge-${value.toLowerCase()}`;
}

export default async function CollegeHome() {
  const reports = await fetchCollegeReports();
  const suspicious = reports.filter((report) => ['medium', 'high', 'critical'].includes(report.severity.toLowerCase())).length;
  const malicious = reports.filter((report) => ['high', 'critical'].includes(report.severity.toLowerCase())).length;
  const safe = reports.filter((report) => report.severity.toLowerCase() === 'low').length;

  return (
    <AppShell title={appTitle} subtitle="Institutional view" navItems={navItems}>
      <section className="workspace-intro"><div><div className="eyebrow">Security intelligence</div><h2>Monitor. Detect. Correlate.</h2><p>Institutional email security through live ingestion, layered detection, and investigation-ready reporting.</p></div><div className="intro-mark">MN / 01</div></section>
      <section className="stat-grid">
        {[
          ['Emails received', reports.length],
          ['Emails analyzed', reports.length],
          ['Suspicious', suspicious],
          ['Malicious', malicious],
          ['Safe', safe]
        ].map(([label, value]) => (
          <div className="stat-card" key={String(label)}><span className="stat-index">{String(Number(['Emails received', 'Emails analyzed', 'Suspicious', 'Malicious', 'Safe'].indexOf(String(label))) + 1).padStart(2, '0')}</span><label>{label}</label><strong>{value}</strong></div>
        ))}
      </section>
      <section className="data-section">
        <div className="section-heading">
          <div><h2>Received email intelligence</h2><div className="muted">Only messages stored by the live ingestion pipeline appear here.</div></div>
          <Link className="nav-link" href="/emails">View all emails</Link>
        </div>
        {reports.length === 0 ? <p className="muted">No emails received for this college yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Time</th><th>Sender</th><th>Subject</th><th>Risk</th><th>Status</th></tr></thead>
            <tbody>{reports.slice(0, 8).map((report) => {
              return <tr key={report.report_id}><td>{report.created_at || 'Unknown'}</td><td>Message available in report</td><td>{report.title}</td><td><span className={riskClass(report.severity)}>{report.severity}</span></td><td>ANALYZED</td></tr>;
            })}</tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
