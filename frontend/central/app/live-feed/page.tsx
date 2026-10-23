'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralReports } from '../../lib/api';
import { RequestError } from '../../components/RequestError';
import { CENTRAL_NAV } from '../../lib/nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/api/developer2/ws/live-feed';

type FeedEvent = {
  id: string;
  event_type?: string;
  timestamp?: string;
  receivedAt?: number;
  tenant_id?: string;
  campaign_id?: string;
  risk_score?: number;
  severity?: string;
  title?: string;
  data?: Record<string, unknown>;
};

function formatRelativeTime(timestampMs: number, now: number) {
  const diffSec = Math.max(0, Math.floor((now - timestampMs) / 1000));
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function riskBadgeClass(severity?: string) {
  const s = (severity || '').toLowerCase();
  switch (s) {
    case 'critical': return 'badge badge-critical';
    case 'high': return 'badge badge-high';
    case 'medium': return 'badge badge-medium';
    case 'review': return 'badge badge-review';
    case 'low': return 'badge badge-low';
    default: return 'badge badge-neutral';
  }
}

export default function CentralLiveFeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<FeedEvent | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'campaign' | 'ingestion'>('all');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [reportError, setReportError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Active time ticker for relative timestamps
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let cancelled = false;
    setReportError('');

    fetchCentralReports().then((result) => {
      if (cancelled) return;
      const initial: FeedEvent[] = result.reports.map((r) => {
        const receivedAt = r.created_at ? new Date(String(r.created_at)).getTime() : Number.NaN;
        return {
          id: `hist-${String(r.report_id)}`,
          event_type: 'REPORT_INGESTED',
          timestamp: r.created_at ? String(r.created_at) : undefined,
          receivedAt: Number.isNaN(receivedAt) ? undefined : receivedAt,
          tenant_id: r.organization_id ? String(r.organization_id) : undefined,
          severity: typeof r.severity === 'string' ? r.severity : undefined,
          title: typeof r.title === 'string' ? r.title : undefined,
          data: r
        };
      });
      setEvents(initial);
      if (initial.length > 0 && !selectedEvent) {
        setSelectedEvent(initial[0]);
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        setReportError(error instanceof Error ? error.message : 'Could not load report history.');
      }
    });

    try {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => {
        if (!cancelled) setConnected(true);
      };
      socket.onmessage = (event) => {
        if (cancelled || pausedRef.current) return;
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          const newEvent: FeedEvent = {
            id: `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            event_type: typeof payload.type === 'string'
              ? payload.type
              : typeof payload.event_type === 'string' ? payload.event_type : undefined,
            timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : undefined,
            receivedAt: Date.now(),
            tenant_id: typeof payload.tenant_id === 'string'
              ? payload.tenant_id
              : typeof payload.tenant === 'string' ? payload.tenant : undefined,
            campaign_id: payload.campaign_id ? String(payload.campaign_id) : undefined,
            risk_score: typeof payload.risk_score === 'number' && Number.isFinite(payload.risk_score)
              ? payload.risk_score
              : undefined,
            severity: typeof payload.severity === 'string' ? payload.severity : undefined,
            title: typeof (payload.subject || payload.title || payload.detail) === 'string'
              ? String(payload.subject || payload.title || payload.detail)
              : undefined,
            data: payload
          };
          setEvents((prev) => [newEvent, ...prev.slice(0, 99)]);
        } catch {
          // Ignore malformed WS frames
        }
      };
      socket.onclose = () => {
        if (!cancelled) setConnected(false);
      };
      socket.onerror = () => {
        if (!cancelled) setConnected(false);
      };
    } catch {
      setConnected(false);
    }

    return () => {
      cancelled = true;
      if (socket) socket.close();
    };
  }, [reloadKey]);

  const filteredEvents = events.filter((evt) => {
    if (filterType === 'critical') {
      return (evt.severity || '').toLowerCase() === 'critical';
    }
    if (filterType === 'campaign') {
      return !!evt.campaign_id || (evt.event_type || '').includes('CAMPAIGN');
    }
    if (filterType === 'ingestion') {
      return (evt.event_type || '').includes('REPORT') || (evt.event_type || '').includes('INGEST');
    }
    return true;
  });

  return (
    <AppShell title="Live Threat Feed" subtitle="Real-time multi-tenant telemetry stream">
      {/* Feed Controls Bar */}
      <div className="feed-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="status-pill">
            <span className={`status-dot ${connected ? 'is-live' : ''}`} style={{ background: connected ? 'var(--risk-low)' : 'var(--risk-critical)' }} />
            <span>{connected ? 'WebSocket connected' : 'WebSocket disconnected'}</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {filteredEvents.length} events in memory
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="filter-pill-group">
            {(['all', 'critical', 'campaign', 'ingestion'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`filter-pill ${filterType === mode ? 'is-active' : ''}`}
                onClick={() => setFilterType(mode)}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`btn btn-secondary btn-sm ${paused ? 'btn-primary' : ''}`}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? '▶ Resume stream' : '⏸ Pause'}
          </button>

          <button
            type="button"
            className={`btn btn-secondary btn-sm ${soundEnabled ? 'btn-primary' : ''}`}
            onClick={() => setSoundEnabled((s) => !s)}
          >
            {soundEnabled ? '🔊 Sound: On' : '🔇 Mute'}
          </button>
        </div>
      </div>

      {reportError && (
        <RequestError
          message={`Unable to load report history: ${reportError}`}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      <div className="feed-layout-grid">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Age</th>
                <th style={{ width: '120px' }}>Tenant Node</th>
                <th style={{ width: '120px' }}>Event Type</th>
                <th>Threat Summary</th>
                <th style={{ width: '90px' }}>Severity</th>
                <th style={{ width: '70px', textAlign: 'right' }}>Select</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    {reportError ? 'Report history is unavailable.' : 'No events match the selected filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const isSelected = selectedEvent?.id === evt.id;
                  return (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'var(--bg-surface-active)' : undefined
                      }}
                    >
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {evt.receivedAt ? formatRelativeTime(evt.receivedAt, currentTime) : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                        {evt.tenant_id || 'Tenant'}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {evt.event_type || 'Not provided'}
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {evt.title || 'Untitled event'}
                      </td>
                      <td>
                        <span className={riskBadgeClass(evt.severity)}>
                          {evt.severity || 'Not provided'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(evt);
                          }}
                        >
                          {isSelected ? '● Viewing' : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Event Inspector Drawer */}
        <aside className="inspector-card" aria-label="Event inspector">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
              Event Inspector
            </span>
            {selectedEvent?.severity && (
              <span className={riskBadgeClass(selectedEvent.severity)}>
                {selectedEvent.severity.toUpperCase()}
              </span>
            )}
          </div>

          {selectedEvent ? (
            <>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {selectedEvent.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  Tenant: {selectedEvent.tenant_id || 'Not provided'} · Timestamp: {selectedEvent.timestamp || 'Not provided'}
                </div>
              </div>

              {selectedEvent.data && (
                <div>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Raw Telemetry Payload
                  </span>
                  <pre>{JSON.stringify(selectedEvent.data, null, 2)}</pre>
                </div>
              )}

              {selectedEvent.data?.report_id && (
                <Link
                  href={`/reports/${encodeURIComponent(String(selectedEvent.data.report_id))}`}
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                >
                  Open Full Forensic Report Dossier →
                </Link>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '16px 0' }}>
              Select an event row from the stream table to inspect its raw JSON payload and IOC telemetry.
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
