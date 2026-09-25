'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/api/developer2/ws/live-feed';

type FeedEvent = {
  event_type?: string;
  timestamp?: string;
  tenant_id?: string;
  campaign_id?: string;
  risk_score?: number;
  data?: Record<string, unknown>;
};

export default function CentralLiveFeedPage() {
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let cancelled = false;
    fetchCentralReports().then((result) => {
      if (!cancelled) setReports(result.reports || []);
    });
    try {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => setConnected(false);
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as FeedEvent;
          if (event.event_type !== 'CONNECTED') {
            setEvents((current) => [event, ...current].slice(0, 30));
          }
        } catch {
          // Ignore malformed events without taking down the live view.
        }
      };
    } catch {
      setConnected(false);
    }
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, []);

  return (
    <AppShell
      title="Central Security & Correlation SOC"
      subtitle="Cross-tenant view"
      navItems={[...CENTRAL_NAV]}
    >
      <section className="soc-panel">
        <div className="soc-panel-heading"><h2 className="live-title"><span className="status-dot" />Live threat feed</h2><small>{connected ? 'Connected to ingestion stream' : 'Waiting for live connection'}</small></div>
        <div className="soc-feed">
          {events.map((event, index) => {
            const data = event.data || {};
            const title = String(data.subject || event.event_type || 'Live email event');
            return <div key={`${event.timestamp}-${index}`} className="soc-feed-item"><span className="soc-feed-title">{title}</span><span className="soc-feed-meta"><span className="severity-pill severity-high">{event.event_type}</span>{event.tenant_id || 'unknown tenant'}{event.campaign_id ? ` · ${event.campaign_id}` : ''}</span></div>;
          })}
          {reports.map((report) => { const severity = String(report.severity || 'low').toLowerCase(); return <div key={String(report.report_id)} className="soc-feed-item"><span className="soc-feed-title">{String(report.title || 'Suspicious email')}</span><span className="soc-feed-meta"><span className={`severity-pill severity-${severity}`}>{severity}</span>{String(report.report_id)}</span></div>; })}
          {!events.length && !reports.length && <div>No threat events have been received yet.</div>}
        </div>
      </section>
    </AppShell>
  );
}
