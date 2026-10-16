'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

type Report = Record<string, unknown>;

export default function CentralReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCentralReports();
        if (!cancelled) {
          setReports(Array.isArray(res.reports) ? res.reports : []);
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
    return reports.filter((r) => {
      const sev = String(r.severity || 'low').toLowerCase();
      if (severityFilter !== 'all' && sev !== severityFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(r.report_id || '').toLowerCase().includes(q) ||
        String(r.title || '').toLowerCase().includes(q) ||
        String(r.report_type || '').toLowerCase().includes(q) ||
        String(r.organization_id || '').toLowerCase().includes(q)
      );
    });
  }, [reports, severityFilter, searchQuery]);

  return (
    <AppShell
      title="Central Investigation Reports"
      subtitle="Federated forensic analysis, machine learning classifications, and detection evidence"
      navItems={[...CENTRAL_NAV]}
    >
      <div className="soc-subpage">
        {/* Filter and Search Bar */}
        <div className="soc-filter-bar">
          <div className="soc-search-wrapper">
            <span className="soc-search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              className="soc-search-input"
              placeholder="Search reports by ID, threat topic, or tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

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
        </div>

        {/* Reports Grid / Cards */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div>
              <h2>Forensic Report Repository</h2>
              <p>Showing {filteredReports.length} of {reports.length} generated threat reports</p>
            </div>
            <span className="soc-badge info">Federated Audit Log</span>
          </div>

          <div className="soc-card-body">
            {loading ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: '#8fa2bd' }}>
                Loading forensic reports…
              </div>
            ) : filteredReports.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#8fa2bd' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                <strong style={{ display: 'block', color: '#e5f0ff', marginBottom: 6 }}>
                  No reports matching filter
                </strong>
                Try adjusting your search criteria or severity filters.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filteredReports.map((report) => {
                  const sev = String(report.severity || 'low').toLowerCase();
                  const riskScore = (report.risk as Record<string, unknown>)?.base_score ?? (sev === 'critical' ? 62 : sev === 'high' ? 48 : 26);

                  return (
                    <Link
                      key={String(report.report_id)}
                      href={`/reports/${encodeURIComponent(String(report.report_id))}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: 20,
                        background: '#0d1524',
                        border: '1px solid #1f334d',
                        borderRadius: 12,
                        textDecoration: 'none',
                        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = '#4f8ef7';
                        e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = '#1f334d';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#8ec5ff', fontWeight: 700 }}>
                            {String(report.report_id).slice(0, 16)}
                          </span>
                          <span className={`soc-badge ${sev}`}>{sev}</span>
                        </div>

                        <h3 style={{ margin: '12px 0 6px', color: '#f1f5fb', fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>
                          {String(report.title || 'Security Inspection Report')}
                        </h3>

                        <p style={{ margin: 0, color: '#7a91ad', fontSize: 12 }}>
                          {String(report.report_type || 'Email vector analysis')} · Org {String(report.organization_id || 'Shared')}
                        </p>
                      </div>

                      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #162438', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <small style={{ color: '#687e9c', fontSize: 11 }}>Risk:</small>
                          <strong style={{ color: sev === 'critical' ? '#ff6e6e' : '#ffd455', fontSize: 13, fontFamily: '"JetBrains Mono", monospace' }}>
                            {String(riskScore)} / 70
                          </strong>
                        </div>

                        <span style={{ color: '#5599ff', fontSize: 12, fontWeight: 700 }}>
                          Inspect Report →
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
