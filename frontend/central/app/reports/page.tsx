'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { RequestError } from '../../components/RequestError';
import { fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

type Report = Record<string, unknown>;

function riskBadgeClass(severity: string) {
  const s = severity.toLowerCase();
  switch (s) {
    case 'critical': return 'badge badge-critical';
    case 'high': return 'badge badge-high';
    case 'medium': return 'badge badge-medium';
    case 'review': return 'badge badge-review';
    default: return 'badge badge-review';
  }
}

function formatDate(value: unknown) {
  if (!value) return 'Time unavailable';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function CentralReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low' | 'review'>('all');
  const [requestError, setRequestError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRequestError('');
    (async () => {
      try {
        const res = await fetchCentralReports();
        if (!cancelled) {
          setReports(Array.isArray(res.reports) ? res.reports : []);
        }
      } catch (error) {
        if (!cancelled) {
          setReports([]);
          setRequestError(error instanceof Error ? error.message : 'Unable to load reports.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const sev = String(r.severity || 'unknown').toLowerCase();
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
      title="Forensic Reports"
      subtitle="Federated multi-tenant evidence repository"
      navItems={[...CENTRAL_NAV]}
    >
      <header className="page-intro">
        <div>
          <h1>Forensic reports</h1>
          <p>Review persisted suspicious email reports and their available evidence.</p>
        </div>
      </header>
      {requestError && (
        <RequestError
          message={`Unable to load reports: ${requestError}`}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}
      {/* Search and Filter Controls */}
      <div className="feed-controls">
        <div className="filter-pill-group">
          {(['all', 'critical', 'high', 'medium', 'low', 'review'] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              className={`filter-pill ${severityFilter === sev ? 'is-active' : ''}`}
              onClick={() => setSeverityFilter(sev)}
            >
              {sev.toUpperCase()}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="topbar-search-input"
          style={{ width: '240px' }}
          placeholder="Search report ID, threat topic, campus..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Reports Table */}
      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Forensic Report Dossiers ({filteredReports.length})</h2>
            <span className="section-desc">Multi-layer scan results with explainable findings and download formats.</span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading forensic reports repository...</div>
        ) : requestError ? null : filteredReports.length === 0 ? (
          <div className="empty-state">No reports match the selected criteria.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Created</th>
                  <th style={{ width: '140px' }}>Report ID</th>
                  <th style={{ width: '120px' }}>Campus Node</th>
                  <th>Threat Subject / Title</th>
                  <th style={{ width: '100px' }}>Severity</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Dossier</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((r) => (
                  <tr key={String(r.report_id)}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(r.created_at)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                      {String(r.report_id)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {String(r.organization_id ?? 'Not assigned')}
                    </td>
                    <td>
                      <Link
                        href={`/reports/${encodeURIComponent(String(r.report_id))}`}
                        className="table-subject-link"
                      >
                        {String(r.title || 'Untitled report')}
                      </Link>
                    </td>
                    <td>
                      <span className={riskBadgeClass(String(r.severity || ''))}>
                        {String(r.severity || 'Not provided')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/reports/${encodeURIComponent(String(r.report_id))}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
