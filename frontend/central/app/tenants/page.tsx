'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { RequestError } from '../../components/RequestError';
import { fetchCentralOrganizations, fetchCentralOrganizationReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

type Organization = {
  id: number;
  name: string;
  domains: string[];
};

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

export default function CentralTenantsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [organizationError, setOrganizationError] = useState('');
  const [reportError, setReportError] = useState('');
  const [organizationReload, setOrganizationReload] = useState(0);
  const [reportReload, setReportReload] = useState(0);

  // Load organizations
  useEffect(() => {
    let cancelled = false;
    setLoadingOrgs(true);
    setOrganizationError('');
    (async () => {
      try {
        const orgs = await fetchCentralOrganizations();
        if (!cancelled) {
          setOrganizations(orgs);
          setOrganizationError('');
          if (orgs.length > 0) {
            setSelectedOrgId(orgs[0].id);
          }
        }
      } catch {
        if (!cancelled) setOrganizationError('Unable to load registered organizations.');
      } finally {
        if (!cancelled) setLoadingOrgs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationReload]);

  // Load reports for selected organization
  useEffect(() => {
    if (selectedOrgId == null) {
      setLoadingReports(false);
      setReports([]);
      return;
    }
    let cancelled = false;
    setLoadingReports(true);
    setReportError('');
    (async () => {
      try {
        const res = await fetchCentralOrganizationReports(selectedOrgId);
        if (!cancelled) {
          setReports(Array.isArray(res.reports) ? res.reports : []);
          setReportError('');
        }
      } catch {
        if (!cancelled) {
          setReports([]);
          setReportError('Unable to load reports for the selected organization.');
        }
      } finally {
        if (!cancelled) setLoadingReports(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId, reportReload]);

  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return organizations;
    const q = searchQuery.toLowerCase();
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.domains.some((d) => d.toLowerCase().includes(q))
    );
  }, [organizations, searchQuery]);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  const stats = useMemo(() => {
    const totalReports = reports.length;
    const critical = reports.filter((r) => String(r.severity || '').toLowerCase() === 'critical').length;
    const high = reports.filter((r) => String(r.severity || '').toLowerCase() === 'high').length;
    return { totalReports, critical, high };
  }, [reports]);

  return (
    <AppShell
      title="Tenant Management"
      subtitle="Federated multi-campus isolation & domain scopes"
      navItems={[...CENTRAL_NAV]}
    >
      <header className="page-intro">
        <div>
          <h1>Organizations</h1>
          <p>Browse registered organizations and persisted suspicious email reports.</p>
        </div>
      </header>
      {organizationError && (
        <RequestError
          message={organizationError}
          onRetry={() => setOrganizationReload((version) => version + 1)}
        />
      )}
      {reportError && (
        <RequestError
          message={reportError}
          onRetry={() => setReportReload((version) => version + 1)}
        />
      )}
      <div className="tenant-layout-grid">
        {/* Campus Directory */}
        <section className="data-section">
          <div className="section-header">
            <div className="section-title-wrap">
              <h2 className="section-title">Participating Campuses ({organizations.length})</h2>
              <span className="section-desc">Institutions registered with Mail-Nexus</span>
            </div>
          </div>

          <input
            type="text"
            className="topbar-search-input"
            style={{ width: '100%' }}
            placeholder="Search campus or domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {loadingOrgs ? (
            <div className="empty-state">Loading registered institutions...</div>
          ) : organizationError ? null : filteredOrgs.length === 0 ? (
            <div className="empty-state">No campuses match your search.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredOrgs.map((org) => {
                const isSelected = org.id === selectedOrgId;
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => setSelectedOrgId(org.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px',
                      padding: '10px 12px',
                      background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-canvas)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 150ms ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <strong style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)', fontSize: '12px' }}>
                        {org.name}
                      </strong>
                      <span className="status-dot is-live" />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                      {org.domains.map((d) => (
                        <span key={d} className="signal-tag" style={{ fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected Campus Detail & Incident Reports */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {selectedOrg ? (
            <>
              {/* Scope KPI Cards */}
              <section className="stat-grid">
                <div className="stat-card">
                  <span className="stat-card-label">Institution Scope</span>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {selectedOrg.name}
                  </div>
                  <span className="stat-card-detail">Org ID #{selectedOrg.id}</span>
                </div>

                <div className="stat-card">
                  <span className="stat-card-label">Isolated Incidents</span>
                  <div className="stat-card-value">{stats.totalReports}</div>
                  <span className="stat-card-detail">Logged threat reports</span>
                </div>

                <div className="stat-card tone-critical">
                  <span className="stat-card-label">Critical reports</span>
                  <div className="stat-card-value">{stats.critical}</div>
                  <span className="stat-card-detail">Requiring SOC intervention</span>
                </div>

                <div className="stat-card tone-high">
                  <span className="stat-card-label">High-severity reports</span>
                  <div className="stat-card-value">{stats.high}</div>
                  <span className="stat-card-detail">Severity reported by the API</span>
                </div>
              </section>

              {/* Reports Table for Selected Tenant */}
              <section className="data-section">
                <div className="section-header">
                  <div className="section-title-wrap">
                    <h2 className="section-title">Incident Reports for {selectedOrg.name}</h2>
                    <span className="section-desc">Filtered strictly to this campus boundary scope.</span>
                  </div>
                </div>

                {loadingReports ? (
                  <div className="empty-state">Loading tenant-scoped reports...</div>
                ) : reportError ? null : reports.length === 0 ? (
                  <div className="empty-state">No incident reports recorded for this campus.</div>
                ) : (
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '140px' }}>Report ID</th>
                          <th>Threat Topic / Subject</th>
                          <th style={{ width: '100px' }}>Severity</th>
                          <th style={{ width: '110px' }}>Status</th>
                          <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((report) => (
                          <tr key={String(report.report_id)}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                              {String(report.report_id)}
                            </td>
                            <td>
                              <Link
                                href={`/reports/${encodeURIComponent(String(report.report_id))}`}
                                className="table-subject-link"
                              >
                                {String(report.title || 'Inbound Incident')}
                              </Link>
                            </td>
                            <td>
                              <span className={riskBadgeClass(String(report.severity || ''))}>
                                {String(report.severity || 'Not provided')}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-neutral">ANALYZED</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <Link
                                href={`/reports/${encodeURIComponent(String(report.report_id))}`}
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
            </>
          ) : (
            <div className="empty-state">Select an institution from the directory.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
