'use client';

import { useState } from 'react';
import type { EmailReport } from '../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function displayValue(value: unknown): string {
  if (value == null || value === '') return 'Not available';
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(', ') : 'None';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item != null && item !== '');
    return entries.length ? entries.map(([key, item]) => `${key}: ${displayValue(item)}`).join(' · ') : 'Not available';
  }
  return String(value);
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="report-detail-section"><h3>{title}</h3>{children}</div>;
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
      const context = saved ? JSON.parse(saved) as { organizationId?: number | null } : {};
      const query = context.organizationId ? `?organization_id=${context.organizationId}` : '';
      const response = await fetch(`${API_URL}/api/reports/${encodeURIComponent(reportId)}${query}`, { cache: 'no-store' });
      const payload = response.ok ? await response.json() as Record<string, unknown> : null;
      setDetails((current) => ({ ...current, [reportId]: payload }));
    } catch {
      setDetails((current) => ({ ...current, [reportId]: null }));
    } finally {
      setLoading(null);
    }
  }

  return <div style={{ display: 'grid', gap: 12 }}>{reports.map((report) => {
    const detail = details[report.report_id];
    return <div key={report.report_id} className="report-card">
      <button type="button" onClick={() => toggle(report.report_id)} className="report-trigger">
        <span><strong>{report.title}</strong><span className="muted" style={{ display: 'block', marginTop: 5, font: '12px Arial' }}>{report.report_id} · {report.created_at || 'Date unavailable'}</span></span>
        <span className={`badge badge-${report.severity.toLowerCase()}`}>{openId === report.report_id ? 'CLOSE' : report.severity}</span>
      </button>
      {openId === report.report_id && <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        {loading === report.report_id ? <div className="loading-panel">Loading report details...</div> : detail ? <>
          <div className="stat-grid"><div className="stat-card"><label>Report ID</label><strong style={{ fontSize: 15 }}>{report.report_id}</strong></div><div className="stat-card"><label>Status</label><strong style={{ fontSize: 15 }}>ANALYZED</strong></div><div className="stat-card"><label>College</label><strong style={{ fontSize: 15 }}>Current organization</strong></div></div>
          <ReportSection title="Email"><div className="report-detail-grid"><div><label>From</label><strong>{displayValue((detail.message as Record<string, unknown> | undefined)?.from)}</strong></div><div><label>To</label><strong>{displayValue((detail.message as Record<string, unknown> | undefined)?.to)}</strong></div><div><label>Subject</label><strong>{displayValue((detail.message as Record<string, unknown> | undefined)?.subject)}</strong></div></div></ReportSection>
          <ReportSection title="Risk"><div className="report-detail-grid"><div><label>Score</label><strong>{displayValue((detail.risk as Record<string, unknown> | undefined)?.base_score)} / 70</strong></div><div><label>Severity</label><strong>{displayValue((detail.risk as Record<string, unknown> | undefined)?.severity)}</strong></div><div><label>Status</label><strong>{displayValue((detail.risk as Record<string, unknown> | undefined)?.status)}</strong></div></div></ReportSection>
          <ReportSection title="Findings"><div className="report-detail-copy">{displayValue(detail.findings)}</div></ReportSection>
          <ReportSection title="Authentication"><div className="report-detail-copy">{displayValue(detail.authentication)}</div></ReportSection>
          <ReportSection title="Location"><div className="report-detail-copy">{displayValue(detail.geolocation)}</div></ReportSection>
          <ReportSection title="Recommended action"><div className="report-detail-copy">{displayValue((detail.advisory as Record<string, unknown> | undefined)?.recommended_actions || (detail.advisory as Record<string, unknown> | undefined)?.summary)}</div></ReportSection>
        </> : <p className="muted">Report details are temporarily unavailable.</p>}
      </div>}
    </div>;
  })}</div>;
}
