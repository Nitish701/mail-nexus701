'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EmailReport } from '../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

function displayValue(value: unknown): string {
  if (value == null || value === '') return 'Not available';
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(', ') : 'None';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, item]) => item != null && item !== ''
    );
    return entries.length
      ? entries.map(([key, item]) => `${key}: ${displayValue(item)}`).join(' · ')
      : 'Not available';
  }
  return String(value);
}

function formatDate(value?: string) {
  if (!value) return 'Unknown date';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function ReportAccordion({ reports }: { reports: EmailReport[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Record<string, unknown> | null>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function toggle(reportId: string) {
    const nextOpen = openId === reportId ? null : reportId;
    setOpenId(nextOpen);
    if (!nextOpen || reportId in details) return;

    setLoading(reportId);
    try {
      const saved = window.sessionStorage.getItem('mail-nexus-college-context');
      const context = saved ? (JSON.parse(saved) as { organizationId?: number | null }) : {};
      const query = context.organizationId ? `?organization_id=${context.organizationId}` : '';
      const response = await fetch(`${API_URL}/api/reports/${encodeURIComponent(reportId)}${query}`, {
        cache: 'no-store'
      });
      const payload = response.ok ? ((await response.json()) as Record<string, unknown>) : null;
      setDetails((current) => ({ ...current, [reportId]: payload }));
    } catch {
      setDetails((current) => ({ ...current, [reportId]: null }));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {reports.map((report) => {
        const isOpen = openId === report.report_id;
        const detail = details[report.report_id];
        const msg = detail?.message as Record<string, unknown> | undefined;
        const risk = detail?.risk as Record<string, unknown> | undefined;
        const advisory = detail?.advisory as Record<string, unknown> | undefined;

        return (
          <article key={report.report_id} className="report-detail-card">
            <button
              type="button"
              onClick={() => toggle(report.report_id)}
              className="report-accordion-head"
              aria-expanded={isOpen}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0
                  }}
                >
                  {formatDate(report.created_at)}
                </span>
                <span
                  style={{
                    color: 'var(--accent)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0
                  }}
                >
                  {report.report_id}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {report.title}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span className={riskBadgeClass(report.severity)}>{report.severity}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {isOpen ? '▲ Collapse' : '▼ Expand'}
                </span>
              </div>
            </button>

            {isOpen && (
              <div>
                {loading === report.report_id ? (
                  <div className="empty-state" style={{ border: 'none', padding: '16px' }}>
                    Loading forensic telemetry from backend...
                  </div>
                ) : detail ? (
                  <div className="report-body-grid">
                    {/* Message Details */}
                    <div className="report-section-block">
                      <span className="report-section-label">Message Envelope</span>
                      <div className="report-code-block">
                        From: {displayValue(msg?.from)}
                        {'\n'}To: {displayValue(msg?.to)}
                        {'\n'}Subject: {displayValue(msg?.subject)}
                      </div>
                    </div>

                    {/* Risk Scoring */}
                    <div className="report-section-block">
                      <span className="report-section-label">Risk Scoring Engine</span>
                      <div className="report-code-block">
                        Base Score: {displayValue(risk?.base_score)} / 70
                        {'\n'}Severity: {displayValue(risk?.severity || report.severity)}
                        {'\n'}Disposition: {displayValue(risk?.disposition || 'Needs Analyst Attention')}
                      </div>
                    </div>

                    {/* Findings */}
                    <div className="report-section-block" style={{ gridColumn: '1 / -1' }}>
                      <span className="report-section-label">Heuristic Findings & IOCs</span>
                      <div className="report-code-block">{displayValue(detail.findings)}</div>
                    </div>

                    {/* Authentication */}
                    <div className="report-section-block">
                      <span className="report-section-label">Authentication Layer</span>
                      <div className="report-code-block">{displayValue(detail.authentication)}</div>
                    </div>

                    {/* Geolocation */}
                    <div className="report-section-block">
                      <span className="report-section-label">Source Origin & Geolocation</span>
                      <div className="report-code-block">{displayValue(detail.geolocation)}</div>
                    </div>

                    {/* Plain Language Advisory */}
                    <div className="report-section-block" style={{ gridColumn: '1 / -1' }}>
                      <span className="report-section-label">Threat Analysis Advisory</span>
                      <div
                        className="report-code-block"
                        style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                      >
                        {displayValue(advisory?.detailed_report || advisory?.summary)}
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '6px'
                      }}
                    >
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Analysis state: Completed
                      </span>
                      <Link
                        href={`/reports/${encodeURIComponent(report.report_id)}`}
                        className="btn btn-primary btn-sm"
                      >
                        Open Full Forensic Dossier →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state" style={{ border: 'none', padding: '16px' }}>
                    Report details are temporarily unavailable or withheld.
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
