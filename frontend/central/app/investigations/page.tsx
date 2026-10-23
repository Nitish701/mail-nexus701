'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
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

export default function CentralInvestigationsPage() {
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
        const result = await fetchCentralReports();
        if (!cancelled) {
          setReports(Array.isArray(result.reports) ? result.reports : []);
        }
      } catch (error) {
        if (!cancelled) {
          setReports([]);
          setRequestError(error instanceof Error ? error.message : 'Unable to load investigations.');
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
    return reports.filter((report) => {
      const severity = String(report.severity || 'unknown').toLowerCase();
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
    const orgs = new Set(
      reports.map((r) => r.organization_id).filter((id) => id !== null && id !== undefined).map(String)
    ).size;
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
      title="Investigations Queue"
      subtitle="Federated threat triage across all campus mailstreams"
      navItems={[...CENTRAL_NAV]}
    >
      <header className="page-intro">
        <div>
          <h1>Investigation queue</h1>
          <p>Filter and inspect suspicious email reports returned by the backend.</p>
        </div>
      </header>
      {requestError && (
        <RequestError
          message={`Unable to load investigations: ${requestError}`}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}
      {/* KPI Row */}
      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-card-label">Suspicious reports</span>
          <div className="stat-card-value">{stats.total}</div>
          <span className="stat-card-detail">Reports returned by the API</span>
        </div>

        <div className="stat-card tone-critical">
          <span className="stat-card-label">Critical reports</span>
          <div className="stat-card-value">{stats.critical}</div>
          <span className="stat-card-detail">Immediate action required</span>
        </div>

        <div className="stat-card tone-high">
          <span className="stat-card-label">High-severity reports</span>
          <div className="stat-card-value">{stats.high}</div>
          <span className="stat-card-detail">Severity reported by the API</span>
        </div>

        <div className="stat-card tone-ok">
          <span className="stat-card-label">Organizations with reports</span>
          <div className="stat-card-value">{stats.orgs}</div>
          <span className="stat-card-detail">Organizations with assigned reports</span>
        </div>
      </section>

      {/* Filter and Search Bar */}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            className="topbar-search-input"
            style={{ width: '220px' }}
            placeholder="Search report ID, sender, org..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
            disabled={!filteredReports.length}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Investigations Table */}
      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Federated Incident Queue ({filteredReports.length})</h2>
            <span className="section-desc">Showing incident dossiers flagged across institutions. Click any report to inspect evidence.</span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading investigation queue...</div>
        ) : requestError ? null : filteredReports.length === 0 ? (
          <div className="empty-state">No investigations match the selected filter criteria.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Created</th>
                  <th style={{ width: '140px' }}>Report ID</th>
                  <th style={{ width: '120px' }}>Institution</th>
                  <th>Threat Subject / Title</th>
                  <th style={{ width: '100px' }}>Severity</th>
                  <th style={{ width: '110px' }}>Status</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={String(report.report_id)}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(report.created_at)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                      {String(report.report_id)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {String(report.organization_id ?? 'Not assigned')}
                    </td>
                    <td>
                      <Link
                        href={`/reports/${encodeURIComponent(String(report.report_id))}`}
                        className="table-subject-link"
                      >
                        {String(report.title || 'Threat Investigation')}
                      </Link>
                    </td>
                    <td>
                      <span className={riskBadgeClass(String(report.severity || 'high'))}>
                        {String(report.severity || 'Not provided')}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-review">UNDER REVIEW</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/reports/${encodeURIComponent(String(report.report_id))}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Triage
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
