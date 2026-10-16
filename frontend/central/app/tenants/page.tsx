'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralOrganizations, fetchCentralOrganizationReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

type Organization = {
  id: number;
  name: string;
  domains: string[];
};

type Report = Record<string, unknown>;

export default function CentralTenantsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load organizations
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgs = await fetchCentralOrganizations();
        if (!cancelled) {
          setOrganizations(orgs);
          if (orgs.length > 0) {
            setSelectedOrgId(orgs[0].id);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!cancelled) setLoadingOrgs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load reports for selected organization
  useEffect(() => {
    if (selectedOrgId == null) return;
    let cancelled = false;
    setLoadingReports(true);
    (async () => {
      try {
        const res = await fetchCentralOrganizationReports(selectedOrgId);
        if (!cancelled) {
          setReports(Array.isArray(res.reports) ? res.reports : []);
        }
      } catch {
        if (!cancelled) setReports([]);
      } finally {
        if (!cancelled) setLoadingReports(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

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
      title="Multi-Tenant Security Command Center"
      subtitle="Federated cross-campus registration, isolated threat scopes, and domain intelligence"
      navItems={[...CENTRAL_NAV]}
    >
      <div className="soc-subpage">
        {/* Organizations Section */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div>
              <h2>Connected Institutions ({organizations.length})</h2>
              <p>Select a campus tenant to inspect its scoped suspicious report stream</p>
            </div>
            <div className="soc-search-wrapper" style={{ maxWidth: 300 }}>
              <span className="soc-search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                type="text"
                className="soc-search-input"
                placeholder="Filter campuses by name or domain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '8px 12px 8px 34px', fontSize: 12 }}
              />
            </div>
          </div>

          <div className="soc-card-body">
            {loadingOrgs ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#8fa2bd' }}>
                Loading registered campus tenants…
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#8fa2bd' }}>
                No campus organizations match your filter.
              </div>
            ) : (
              <div className="soc-tenant-grid">
                {filteredOrgs.map((org) => {
                  const isSelected = selectedOrgId === org.id;
                  return (
                    <div
                      key={org.id}
                      className={`soc-tenant-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedOrgId(org.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: '#8ec5ff', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>
                          TENANT #{org.id}
                        </span>
                        <span className="soc-badge low" style={{ fontSize: 9 }}>
                          ACTIVE
                        </span>
                      </div>

                      <h3 style={{ margin: '10px 0 6px', color: '#f1f5fb', fontSize: 17, fontWeight: 700 }}>
                        {org.name}
                      </h3>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                        {org.domains.map((domain) => (
                          <span
                            key={domain}
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid #223752',
                              borderRadius: 4,
                              padding: '2px 7px',
                              color: '#a7bbd4',
                              fontSize: 11,
                              fontFamily: '"JetBrains Mono", monospace'
                            }}
                          >
                            {domain}
                          </span>
                        ))}
                      </div>

                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #1a2a40', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: '#6e85a3', fontSize: 11 }}>Cryptographic Isolation</small>
                        <span style={{ color: isSelected ? '#60a5fa' : '#8da4c2', fontSize: 11, fontWeight: 700 }}>
                          {isSelected ? '● Scoped' : 'Select →'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Selected Organization's Scoped Reports */}
        {selectedOrg && (
          <div className="soc-card">
            <div className="soc-card-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2>{selectedOrg.name} — Scoped Threat Stream</h2>
                  <span className="soc-badge info">Tenant #{selectedOrg.id}</span>
                </div>
                <p>
                  Isolated threat telemetry for domains: {selectedOrg.domains.join(', ')}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ padding: '6px 14px', background: '#0a101d', border: '1px solid #223752', borderRadius: 8 }}>
                  <small style={{ color: '#7a91ad', fontSize: 10, display: 'block', textTransform: 'uppercase' }}>Reports</small>
                  <strong style={{ color: '#f1f5fb', fontSize: 16 }}>{stats.totalReports}</strong>
                </div>
                <div style={{ padding: '6px 14px', background: '#0a101d', border: '1px solid #223752', borderRadius: 8 }}>
                  <small style={{ color: '#ff857f', fontSize: 10, display: 'block', textTransform: 'uppercase' }}>Critical</small>
                  <strong style={{ color: '#ff6e6e', fontSize: 16 }}>{stats.critical}</strong>
                </div>
              </div>
            </div>

            <div className="soc-card-body" style={{ padding: 0 }}>
              {loadingReports ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8fa2bd' }}>
                  Loading scoped reports for {selectedOrg.name}…
                </div>
              ) : reports.length === 0 ? (
                <div style={{ padding: '50px 24px', textAlign: 'center', color: '#8fa2bd' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🛡️</div>
                  <strong style={{ display: 'block', color: '#e5f0ff', marginBottom: 6 }}>
                    No suspicious activity logged
                  </strong>
                  All email traffic within {selectedOrg.name} has passed local heuristic & ML scrutiny.
                </div>
              ) : (
                <div className="soc-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="soc-table">
                    <thead>
                      <tr>
                        <th>Report ID</th>
                        <th>Threat Title / Subject</th>
                        <th>Severity</th>
                        <th>Risk Score</th>
                        <th>Recorded Date</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => {
                        const sev = String(report.severity || 'low').toLowerCase();
                        const riskScore = (report.risk as Record<string, unknown>)?.base_score ?? (sev === 'critical' ? 64 : sev === 'high' ? 51 : 28);
                        return (
                          <tr key={String(report.report_id)}>
                            <td>
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#8ec5ff' }}>
                                {String(report.report_id).slice(0, 16)}
                              </span>
                            </td>
                            <td>
                              <strong style={{ color: '#f1f5fb' }}>
                                {String(report.title || 'Suspicious Email Ingestion')}
                              </strong>
                            </td>
                            <td>
                              <span className={`soc-badge ${sev}`}>{sev}</span>
                            </td>
                            <td>
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: sev === 'critical' ? '#ff6e6e' : '#ffd455' }}>
                                {String(riskScore)} / 70
                              </span>
                            </td>
                            <td>
                              <span style={{ color: '#7a8fa9', fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>
                                {report.created_at ? String(report.created_at).slice(0, 16).replace('T', ' ') : 'Live'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <Link
                                href={`/reports/${encodeURIComponent(String(report.report_id))}`}
                                className="btn-primary"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                              >
                                Review Evidence →
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
        )}
      </div>
    </AppShell>
  );
}
