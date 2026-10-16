'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { AppShell } from '../../components/AppShell';
import { fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

type Report = Record<string, unknown>;

export default function CentralInvestigationsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchCentralReports();
        if (!cancelled) {
          setReports(Array.isArray(result.reports) ? result.reports : []);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const severity = String(report.severity || 'low').toLowerCase();
      if (severityFilter !== 'all' && severity !== severityFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const id = String(report.report_id || '').toLowerCase();
      const title = String(report.title || '').toLowerCase();
      const sender = String(report.sender || '').toLowerCase();
      const org = String(report.organization_id || '').toLowerCase();

      return id.includes(q) || title.includes(q) || sender.includes(q) || org.includes(q);
    });
  }, [reports, searchQuery, severityFilter]);

  const stats = useMemo(() => {
    const total = reports.length;
    const critical = reports.filter((r) => String(r.severity || '').toLowerCase() === 'critical').length;
    const high = reports.filter((r) => String(r.severity || '').toLowerCase() === 'high').length;
    const orgs = new Set(reports.map((r) => String(r.organization_id || 'default'))).size;
    return { total, critical, high, orgs };
  }, [reports]);

  const handleExportCsv = () => {
    if (!filteredReports.length) return;
    const headers = ['Report ID', 'Title', 'Severity', 'Risk Score', 'Organization', 'Created At'];
    const rows = filteredReports.map((r) => [
      `"${String(r.report_id || '')}"`,
      `"${String(r.title || '').replace(/"/g, '""')}"`,
      `"${String(r.severity || '')}"`,
      `"${String((r.risk as Record<string, unknown>)?.base_score ?? 'N/A')}"`,
      `"${String(r.organization_id || '')}"`,
      `"${String(r.created_at || '')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `investigations-export-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell
      title="Central Investigations Queue"
      subtitle="Federated threat triage across all connected institution mailstreams"
      navItems={[...CENTRAL_NAV]}
    >
      <div className="soc-subpage">
        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div className="soc-card" style={{ padding: '18px 20px' }}>
            <span style={{ color: '#8fa2bd', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Active Investigations
            </span>
            <div style={{ color: '#f1f5fb', fontSize: 28, fontWeight: 800, marginTop: 6, fontFamily: '"JetBrains Mono", monospace' }}>
              {stats.total}
            </div>
            <small style={{ color: '#687e9c', fontSize: 11 }}>Suspicious threshold crossed</small>
          </div>

          <div className="soc-card" style={{ padding: '18px 20px', borderTop: '2px solid #ef665f' }}>
            <span style={{ color: '#ff857f', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Critical Severity
            </span>
            <div style={{ color: '#ff766e', fontSize: 28, fontWeight: 800, marginTop: 6, fontFamily: '"JetBrains Mono", monospace' }}>
              {stats.critical}
            </div>
            <small style={{ color: '#687e9c', fontSize: 11 }}>Immediate SOC intervention</small>
          </div>

          <div className="soc-card" style={{ padding: '18px 20px', borderTop: '2px solid #ffaa55' }}>
            <span style={{ color: '#ffb977', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              High-Risk Threats
            </span>
            <div style={{ color: '#ffaa55', fontSize: 28, fontWeight: 800, marginTop: 6, fontFamily: '"JetBrains Mono", monospace' }}>
              {stats.high}
            </div>
            <small style={{ color: '#687e9c', fontSize: 11 }}>Escalated correlation signals</small>
          </div>

          <div className="soc-card" style={{ padding: '18px 20px', borderTop: '2px solid #5599ff' }}>
            <span style={{ color: '#85b8ff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Impacted Tenants
            </span>
            <div style={{ color: '#73aaff', fontSize: 28, fontWeight: 800, marginTop: 6, fontFamily: '"JetBrains Mono", monospace' }}>
              {stats.orgs}
            </div>
            <small style={{ color: '#687e9c', fontSize: 11 }}>Participating campuses</small>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="soc-filter-bar">
          <div className="soc-search-wrapper">
            <span className="soc-search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              className="soc-search-input"
              placeholder="Search by Report ID, subject, sender, or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="soc-pill-group">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  className={`soc-pill-btn ${severityFilter === sev ? 'active' : ''}`}
                  onClick={() => setSeverityFilter(sev)}
                >
                  {sev.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="soc-copy-btn"
              onClick={handleExportCsv}
              title="Export investigations as CSV"
              style={{ padding: '8px 14px' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Table Card */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div>
              <h2>Investigation Queue</h2>
              <p>Showing {filteredReports.length} of {reports.length} security alerts</p>
            </div>
            <span className="soc-badge info">Autonomous Correlation Enabled</span>
          </div>

          <div className="soc-card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#8aa0be' }}>
                Loading threat investigations…
              </div>
            ) : filteredReports.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8fa2bd' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🛡️</div>
                <strong style={{ display: 'block', color: '#e5f0ff', marginBottom: 6 }}>No matching investigations found</strong>
                {reports.length === 0
                  ? 'No suspicious emails have crossed the federated threat threshold yet.'
                  : 'Try adjusting your search query or severity filters.'}
              </div>
            ) : (
              <div className="soc-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="soc-table">
                  <thead>
                    <tr>
                      <th>Report ID</th>
                      <th>Threat Subject / Title</th>
                      <th>Severity</th>
                      <th>Risk Meter</th>
                      <th>Campus Tenant</th>
                      <th>Observed</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((report) => {
                      const sev = String(report.severity || 'low').toLowerCase();
                      const riskScore = Number((report.risk as Record<string, unknown>)?.base_score ?? (sev === 'critical' ? 65 : sev === 'high' ? 52 : sev === 'medium' ? 38 : 22));
                      const maxScore = 70;
                      const scorePct = Math.min(100, Math.round((riskScore / maxScore) * 100));

                      return (
                        <tr key={String(report.report_id)}>
                          <td>
                            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#8ec5ff' }}>
                              {String(report.report_id).slice(0, 14)}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: '#f0f5ff', display: 'block', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {String(report.title || 'Suspicious Email Ingestion')}
                            </strong>
                            <small style={{ color: '#768ca8', fontSize: 11 }}>
                              {String(report.report_type || 'Email threat vector')}
                            </small>
                          </td>
                          <td>
                            <span className={`soc-badge ${sev}`}>{sev}</span>
                          </td>
                          <td>
                            <div className="soc-risk-meter">
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 700, width: 44 }}>
                                {riskScore}/{maxScore}
                              </span>
                              <div className="soc-risk-bar">
                                <div className={`soc-risk-fill ${sev}`} style={{ width: `${scorePct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: '#a5b7d1', fontSize: 12 }}>
                              Org {String(report.organization_id || 'Federated')}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#7a8fa9', fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>
                              {report.created_at ? String(report.created_at).slice(0, 16).replace('T', ' ') : 'Live stream'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Link
                              href={`/reports/${encodeURIComponent(String(report.report_id))}`}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: 12, textDecoration: 'none' }}
                            >
                              Investigate →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
