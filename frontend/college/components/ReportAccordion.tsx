'use client';

import { useState } from 'react';
import type { EmailReport } from '../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    return <div key={report.report_id} style={{ border: '1px solid #d6e0e3', background: '#fff', padding: 16 }}>
      <button type="button" onClick={() => toggle(report.report_id)} style={{ width: '100%', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <span><strong>{report.title}</strong><span className="muted" style={{ display: 'block', marginTop: 5, font: '12px Arial' }}>{report.report_id} · {report.created_at || 'Date unavailable'}</span></span>
        <span className={`badge badge-${report.severity.toLowerCase()}`}>{openId === report.report_id ? 'CLOSE' : report.severity}</span>
      </button>
      {openId === report.report_id && <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        {loading === report.report_id ? <div className="loading-panel">Loading report details...</div> : detail ? <>
          <div className="stat-grid"><div className="stat-card"><label>Report ID</label><strong style={{ fontSize: 15 }}>{report.report_id}</strong></div><div className="stat-card"><label>Status</label><strong style={{ fontSize: 15 }}>ANALYZED</strong></div><div className="stat-card"><label>College</label><strong style={{ fontSize: 15 }}>Current organization</strong></div></div>
          {['message', 'risk', 'authentication', 'layers', 'geolocation', 'urls', 'attachments', 'virustotal', 'advisory'].map((key) => <div className="data-section" key={key}><h3>{key === 'geolocation' ? 'Geolocation assessment' : key}</h3><pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: '12px/1.5 Consolas, monospace', color: '#4d5d68' }}>{JSON.stringify(detail[key], null, 2)}</pre></div>)}
        </> : <p className="muted">Report details are temporarily unavailable.</p>}
      </div>}
    </div>;
  })}</div>;
}
