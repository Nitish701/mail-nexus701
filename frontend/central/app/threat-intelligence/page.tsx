'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { RequestError } from '../../components/RequestError';
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

function riskBadgeClass(severity: string) {
  const s = severity.toLowerCase();
  switch (s) {
    case 'critical': return 'badge badge-critical';
    case 'high': return 'badge badge-high';
    case 'medium': return 'badge badge-medium';
    case 'review': return 'badge badge-review';
    default: return 'badge badge-neutral';
  }
}

export default function ThreatIntelligencePage() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'URL' | 'Domain' | 'IP' | 'Hash'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRequestError('');
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
                  threatType: 'Phishing Landing Target'
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
                      threatType: 'Suspect Sender/Relay Domain'
                    });
                  }
                } catch {
                  // Ignore invalid URL
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
                  threatType: isIp ? 'Malicious C2 Host' : isHash ? 'Payload Hash' : 'Pattern Signature'
                });
              }
            });
          }

          // Extract Geolocation IP
          const geo = detail.geolocation as Record<string, unknown> | undefined;
          if (geo?.source_ip) {
            extracted.push({
              id: `ip-${reportId}`,
              type: 'IP',
              value: String(geo.source_ip),
              reportId,
              severity,
              threatType: `Inbound Sender IP (${geo.country_name || 'Global'})`
            });
          }
        });

        // Deduplicate by value
        const unique = Array.from(new Map(extracted.map((item) => [item.value, item])).values());
        setIndicators(unique);
      } catch (error) {
        if (!cancelled) {
          setIndicators([]);
          setRequestError(error instanceof Error ? error.message : 'Unable to load threat intelligence.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const filteredIndicators = useMemo(() => {
    return indicators.filter((ind) => {
      if (activeTab !== 'all' && ind.type !== activeTab) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ind.value.toLowerCase().includes(q) ||
        ind.threatType?.toLowerCase().includes(q) ||
        ind.reportId.toLowerCase().includes(q)
      );
    });
  }, [indicators, activeTab, searchQuery]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const counts = useMemo(() => {
    const urls = indicators.filter((i) => i.type === 'URL').length;
    const domains = indicators.filter((i) => i.type === 'Domain').length;
    const ips = indicators.filter((i) => i.type === 'IP').length;
    const hashes = indicators.filter((i) => i.type === 'Hash').length;
    return { all: indicators.length, urls, domains, ips, hashes };
  }, [indicators]);

  return (
    <AppShell
      title="Threat Intelligence"
      subtitle="Federated Indicators of Compromise (IOCs)"
      navItems={[...CENTRAL_NAV]}
    >
      <header className="page-intro">
        <div>
          <h1>Threat intelligence</h1>
          <p>Indicators extracted from persisted suspicious email reports.</p>
        </div>
      </header>
      {requestError && (
        <RequestError
          message={`Unable to load threat indicators: ${requestError}`}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}
      {/* Metric Cards */}
      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-card-label">Total Unique IOCs</span>
          <div className="stat-card-value">{counts.all}</div>
          <span className="stat-card-detail">Extracted indicators</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Malicious URLs</span>
          <div className="stat-card-value">{counts.urls}</div>
          <span className="stat-card-detail">Phishing links</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Sender Domains</span>
          <div className="stat-card-value">{counts.domains}</div>
          <span className="stat-card-detail">Host infrastructure</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Connecting IPs</span>
          <div className="stat-card-value">{counts.ips}</div>
          <span className="stat-card-detail">Source IP addresses</span>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="feed-controls">
        <div className="tabs-header" style={{ border: 'none', padding: 0 }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Indicators ({counts.all})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'URL' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('URL')}
          >
            URLs ({counts.urls})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'Domain' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('Domain')}
          >
            Domains ({counts.domains})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'IP' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('IP')}
          >
            IP Addresses ({counts.ips})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'Hash' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('Hash')}
          >
            Hashes ({counts.hashes})
          </button>
        </div>

        <input
          type="text"
          className="topbar-search-input"
          style={{ width: '220px' }}
          placeholder="Filter IOC value or type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* IOC Table */}
      <section className="data-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">Federated IOC Repository ({filteredIndicators.length})</h2>
            <span className="section-desc">Extracted from inbound email scans and correlated across institutions.</span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Extracting threat indicators and hashes...</div>
        ) : requestError ? null : filteredIndicators.length === 0 ? (
          <div className="empty-state">No threat indicators found matching current filters.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Type</th>
                  <th>Indicator Value</th>
                  <th style={{ width: '180px' }}>Classification</th>
                  <th style={{ width: '130px' }}>Source Report</th>
                  <th style={{ width: '90px' }}>Severity</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIndicators.map((ind) => (
                  <tr key={ind.id}>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '9px' }}>
                        {ind.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                      {ind.value}
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {ind.threatType}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                      <Link href={`/reports/${encodeURIComponent(ind.reportId)}`} className="table-subject-link">
                        {ind.reportId}
                      </Link>
                    </td>
                    <td>
                      <span className={riskBadgeClass(ind.severity)}>
                        {ind.severity}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => copyToClipboard(ind.value, ind.id)}
                      >
                        {copiedId === ind.id ? 'Copied!' : 'Copy'}
                      </button>
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
