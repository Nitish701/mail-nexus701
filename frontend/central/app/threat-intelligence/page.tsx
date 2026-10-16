'use client';

import { useEffect, useState, useMemo } from 'react';
import { AppShell } from '../../components/AppShell';
import { fetchCentralReports, fetchCentralReportDetails } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

type Indicator = {
  id: string;
  type: 'URL' | 'Domain' | 'IP' | 'Hash' | 'IOC';
  value: string;
  reportId: string;
  severity: string;
  threatType?: string;
};

export default function ThreatIntelligencePage() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'URL' | 'Domain' | 'IP' | 'Hash'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { reports } = await fetchCentralReports();
        const reportList = Array.isArray(reports) ? reports : [];

        // Sample up to top 15 recent reports to extract rich details without blocking
        const sampleReports = reportList.slice(0, 15);
        const details = await Promise.all(
          sampleReports.map((report) => fetchCentralReportDetails(String(report.report_id)))
        );

        if (cancelled) return;

        const extracted: Indicator[] = [];

        details.forEach((detail, idx) => {
          if (!detail) return;
          const report = sampleReports[idx];
          const reportId = String(report.report_id);
          const severity = String(report.severity || 'high');

          // Extract URLs
          if (Array.isArray(detail.urls)) {
            detail.urls.forEach((url, uIdx) => {
              if (url && typeof url === 'string') {
                extracted.push({
                  id: `url-${reportId}-${uIdx}`,
                  type: 'URL',
                  value: url,
                  reportId,
                  severity,
                  threatType: 'Phishing Landing Page'
                });
                try {
                  const parsed = new URL(url.startsWith('http') ? url : `http://${url}`);
                  if (parsed.hostname) {
                    extracted.push({
                      id: `dom-${reportId}-${uIdx}`,
                      type: 'Domain',
                      value: parsed.hostname,
                      reportId,
                      severity,
                      threatType: 'Suspect Sender/Target Domain'
                    });
                  }
                } catch {
                  // Ignore invalid URL parsing
                }
              }
            });
          }

          // Extract IOCs
          if (Array.isArray(detail.iocs)) {
            detail.iocs.forEach((ioc, iIdx) => {
              const val = typeof ioc === 'object' ? JSON.stringify(ioc) : String(ioc);
              if (val && val.trim()) {
                const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(val.trim());
                const isHash = /^[a-fA-F0-9]{32,64}$/.test(val.trim());
                extracted.push({
                  id: `ioc-${reportId}-${iIdx}`,
                  type: isIp ? 'IP' : isHash ? 'Hash' : 'IOC',
                  value: val,
                  reportId,
                  severity,
                  threatType: isIp ? 'C2 / Malicious Infrastructure' : isHash ? 'Malware Payload Signature' : 'Behavioral Pattern'
                });
              }
            });
          }

          // Extract Geolocation IP if present
          const geo = detail.geolocation as Record<string, unknown> | undefined;
          if (geo?.source_ip) {
            extracted.push({
              id: `ip-${reportId}-${String(geo.source_ip)}`,
              type: 'IP',
              value: String(geo.source_ip),
              reportId,
              severity,
              threatType: `${geo.country || 'External'} Infrastructure (ASN ${geo.asn || 'N/A'})`
            });
          }

          // Extract Fingerprints
          const fp = detail.fingerprint as Record<string, unknown> | undefined;
          if (fp?.body_sha256) {
            extracted.push({
              id: `hash-sha-${reportId}`,
              type: 'Hash',
              value: String(fp.body_sha256),
              reportId,
              severity,
              threatType: 'Email Body SHA-256 Hash'
            });
          }
          if (fp?.tlsh) {
            extracted.push({
              id: `hash-tlsh-${reportId}`,
              type: 'Hash',
              value: String(fp.tlsh),
              reportId,
              severity,
              threatType: 'Fuzzy Locality-Sensitive Hash (TLSH)'
            });
          }
        });

        // Deduplicate indicators by value
        const seen = new Set<string>();
        const unique = extracted.filter((item) => {
          if (seen.has(item.value)) return false;
          seen.add(item.value);
          return true;
        });

        setIndicators(unique);
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

  const stats = useMemo(() => {
    const urls = indicators.filter((i) => i.type === 'URL').length;
    const domains = indicators.filter((i) => i.type === 'Domain').length;
    const ips = indicators.filter((i) => i.type === 'IP').length;
    const hashes = indicators.filter((i) => i.type === 'Hash').length;
    return { total: indicators.length, urls, domains, ips, hashes };
  }, [indicators]);

  const filteredIndicators = useMemo(() => {
    return indicators.filter((item) => {
      if (activeTab !== 'all' && item.type !== activeTab) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.value.toLowerCase().includes(q) ||
        item.reportId.toLowerCase().includes(q) ||
        (item.threatType && item.threatType.toLowerCase().includes(q))
      );
    });
  }, [indicators, activeTab, searchQuery]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const handleExportJson = () => {
    if (!filteredIndicators.length) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredIndicators, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `threat-iocs-stix-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell
      title="Federated Threat Intelligence Hub"
      subtitle="Autonomous cross-tenant IOC aggregation, domain reputation & forensic fingerprints"
      navItems={[...CENTRAL_NAV]}
    >
      <div className="soc-subpage">
        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div className="soc-card" style={{ padding: '16px 20px', borderTop: '2px solid #5599ff' }}>
            <span style={{ color: '#8fa2bd', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Total Unique IOCs
            </span>
            <div style={{ color: '#f1f5fb', fontSize: 26, fontWeight: 800, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
              {stats.total}
            </div>
            <small style={{ color: '#687e9c', fontSize: 11 }}>Active threat markers</small>
          </div>

          <div className="soc-card" style={{ padding: '16px 20px', borderTop: '2px solid #ef665f' }}>
            <span style={{ color: '#ff857f', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Malicious URLs
            </span>
            <div style={{ color: '#ff766e', fontSize: 26, fontWeight: 800, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
              {stats.urls}
            </div>
            <small style={{ color: '#687e9c', fontSize: 11 }}>Credential harvester links</small>
          </div>

          <div className="soc-card" style={{ padding: '16px 20px', borderTop: '2px solid #ffaa55' }}>
            <span style={{ color: '#ffb977', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Suspect Domains
            </span>
            <div style={{ color: '#ffaa55', fontSize: 26, fontWeight: 800, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
              {stats.domains}
            </div>
            <small style={{ color: '#687e9c', fontSize: 11 }}>Lookalike / Spoofed senders</small>
          </div>

          <div className="soc-card" style={{ padding: '16px 20px', borderTop: '2px solid #38bdf8' }}>
            <span style={{ color: '#85d9ff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Malicious IPs
            </span>
            <div style={{ color: '#38bdf8', fontSize: 26, fontWeight: 800, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
              {stats.ips}
            </div>
            <small style={{ color: '#687e9c', fontSize: 11 }}>Host / VPN / Proxy nodes</small>
          </div>

          <div className="soc-card" style={{ padding: '16px 20px', borderTop: '2px solid #a855f7' }}>
            <span style={{ color: '#d8b4fe', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Forensic Hashes
            </span>
            <div style={{ color: '#c084fc', fontSize: 26, fontWeight: 800, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
              {stats.hashes}
            </div>
            <small style={{ color: '#687e9c', fontSize: 11 }}>SHA-256 & TLSH signatures</small>
          </div>
        </div>

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
              placeholder="Search IOCs by URL, domain, IP, or hash pattern..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="soc-pill-group">
              {[
                { id: 'all', label: 'All Indicators' },
                { id: 'URL', label: 'URLs' },
                { id: 'Domain', label: 'Domains' },
                { id: 'IP', label: 'IPs' },
                { id: 'Hash', label: 'Hashes' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`soc-pill-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="soc-copy-btn"
              onClick={handleExportJson}
              style={{ padding: '8px 14px' }}
              title="Export all indicators as JSON"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export STIX/JSON
            </button>
          </div>
        </div>

        {/* Indicators Table Card */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div>
              <h2>Extracted Threat Indicators</h2>
              <p>Showing {filteredIndicators.length} matching indicators</p>
            </div>
            <span className="soc-badge info">Federated Ingestion</span>
          </div>

          <div className="soc-card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#8aa0be' }}>
                Extracting federated threat indicators…
              </div>
            ) : filteredIndicators.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8fa2bd' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                <strong style={{ display: 'block', color: '#e5f0ff', marginBottom: 6 }}>No indicators found</strong>
                {indicators.length === 0
                  ? 'No IOCs have been shared from suspicious emails yet.'
                  : 'Try adjusting your search criteria or category filter.'}
              </div>
            ) : (
              <div className="soc-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="soc-table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Type</th>
                      <th>Indicator / Threat Signature</th>
                      <th>Classification</th>
                      <th>Source Report</th>
                      <th style={{ textAlign: 'right', width: 130 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIndicators.map((item) => {
                      const isCopied = copiedId === item.id;
                      const sev = item.severity.toLowerCase();
                      return (
                        <tr key={item.id}>
                          <td>
                            <span className={`soc-badge ${sev === 'critical' ? 'critical' : sev === 'high' ? 'high' : 'info'}`}>
                              {item.type}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: '#f1f5fb', wordBreak: 'break-all', maxWidth: 440 }}>
                              {item.value}
                            </div>
                          </td>
                          <td>
                            <span style={{ color: '#8fa2bd', fontSize: 12 }}>
                              {item.threatType || 'Observed Threat Vector'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#8ec5ff', fontSize: 12 }}>
                              {item.reportId.slice(0, 16)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className={`soc-copy-btn ${isCopied ? 'copied' : ''}`}
                              onClick={() => handleCopy(item.id, item.value)}
                            >
                              {isCopied ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Copied
                                </>
                              ) : (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                  Copy IOC
                                </>
                              )}
                            </button>
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
