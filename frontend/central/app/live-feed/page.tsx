'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { fetchCentralReports } from '../../lib/api';
import { CENTRAL_NAV } from '../../lib/nav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/api/developer2/ws/live-feed';

type FeedEvent = {
  id: string;
  event_type?: string;
  timestamp?: string;
  receivedAt: number;
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

function playThreatBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch {
    // Audio might be blocked before interaction
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
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  // Active time ticker for relative timestamps
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket and baseline report loading
  useEffect(() => {
    let socket: WebSocket | undefined;
    let cancelled = false;

    // Load initial history from reports
    fetchCentralReports().then((result) => {
      if (cancelled) return;
      const initial: FeedEvent[] = (result.reports || []).map((r, i) => {
        const sev = String(r.severity || 'high').toLowerCase();
        return {
          id: `hist-${String(r.report_id || i)}`,
          event_type: 'REPORT_INGESTED',
          timestamp: String(r.created_at || new Date().toISOString()),
          receivedAt: Date.now() - (i + 1) * 35000,
          tenant_id: String(r.organization_id || 'campus-tenant'),
          severity: sev,
          title: String(r.title || 'Suspicious Email Ingestion Alert'),
          risk_score: (sev === 'critical' ? 68 : sev === 'high' ? 54 : 32),
          data: r
        };
      });
      setEvents(initial);
    });

    try {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => setConnected(false);
      socket.onerror = () => setConnected(false);
      socket.onmessage = (message) => {
        try {
          const raw = JSON.parse(message.data) as Record<string, unknown>;
          if (raw.event_type === 'CONNECTED') return;

          if (pausedRef.current) return;

          const data = (raw.data as Record<string, unknown>) || {};
          const sev = String(raw.severity || (raw.risk_score && Number(raw.risk_score) > 60 ? 'critical' : 'high')).toLowerCase();
          const newEvent: FeedEvent = {
            id: `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            event_type: String(raw.event_type || 'THREAT_EVENT'),
            timestamp: String(raw.timestamp || new Date().toISOString()),
            receivedAt: Date.now(),
            tenant_id: String(raw.tenant_id || data.tenant_id || 'Cross-Tenant'),
            campaign_id: raw.campaign_id ? String(raw.campaign_id) : undefined,
            risk_score: raw.risk_score ? Number(raw.risk_score) : (sev === 'critical' ? 68 : 52),
            severity: sev,
            title: String(data.subject || raw.title || raw.event_type || 'Incoming Threat Fingerprint'),
            data: raw
          };

          if (soundRef.current && (sev === 'critical' || sev === 'high')) {
            playThreatBeep();
          }

          setEvents((curr) => [newEvent, ...curr].slice(0, 100));
        } catch {
          // Ignore malformed payloads
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

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filterType === 'critical') {
        return ev.severity === 'critical' || (ev.risk_score && ev.risk_score >= 60);
      }
      if (filterType === 'campaign') {
        return Boolean(ev.campaign_id) || ev.event_type?.includes('CAMPAIGN');
      }
      if (filterType === 'ingestion') {
        return ev.event_type?.includes('INGEST') || ev.event_type?.includes('EMAIL');
      }
      return true;
    });
  }, [events, filterType]);

  return (
    <AppShell
      title="Real-Time Cross-Tenant Threat Stream"
      subtitle="Autonomous fingerprint ingestion, cluster detections, and live correlation events"
      navItems={[...CENTRAL_NAV]}
    >
      <div className="soc-subpage">
        {/* Stream Status & Controls Bar */}
        <div className="soc-filter-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: connected ? '#34d399' : '#f87171',
                  boxShadow: connected ? '0 0 10px #34d399' : '0 0 10px #f87171'
                }}
              />
              <strong style={{ color: '#f1f5fb', fontSize: 13 }}>
                {connected ? 'Ingestion Stream Online' : 'Connecting to Stream…'}
              </strong>
            </div>

            <span style={{ color: '#5b7394', fontSize: 13 }}>|</span>

            <span style={{ color: '#8fa2bd', fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>
              {events.length} events buffered
            </span>

            {paused && (
              <span className="soc-badge high" style={{ fontSize: 10 }}>
                FEED PAUSED
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="soc-pill-group">
              {[
                { id: 'all', label: 'All Events' },
                { id: 'critical', label: 'Critical Threats' },
                { id: 'campaign', label: 'Campaign Clusters' },
                { id: 'ingestion', label: 'Ingestions' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`soc-pill-btn ${filterType === tab.id ? 'active' : ''}`}
                  onClick={() => setFilterType(tab.id as typeof filterType)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`soc-pill-btn ${paused ? 'active' : ''}`}
              onClick={() => setPaused((v) => !v)}
              title={paused ? 'Resume incoming events' : 'Pause stream to inspect'}
            >
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>

            <button
              type="button"
              className={`soc-pill-btn ${soundEnabled ? 'active' : ''}`}
              onClick={() => {
                setSoundEnabled((v) => !v);
                if (!soundEnabled) playThreatBeep();
              }}
              title="Toggle audio alert for critical threats"
            >
              {soundEnabled ? '🔔 Alert ON' : '🔕 Alert OFF'}
            </button>

            <button
              type="button"
              className="soc-copy-btn"
              onClick={() => setEvents([])}
              title="Clear event buffer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Live Stream Panel */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div>
              <h2>Incoming Event Stream</h2>
              <p>Click on any threat signal to view its raw payload and correlation metadata</p>
            </div>
            <span className="soc-badge info">WebSocket 2.0 Ingestion</span>
          </div>

          <div className="soc-card-body" style={{ padding: 0 }}>
            {filteredEvents.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8fa2bd' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
                <strong style={{ display: 'block', color: '#e5f0ff', marginBottom: 6 }}>
                  No live threat events matching filter
                </strong>
                Waiting for incoming events across campus tenants…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredEvents.map((event) => {
                  const sev = event.severity || 'high';
                  const isSelected = selectedEvent?.id === event.id;

                  return (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '16px 24px',
                        borderBottom: '1px solid #1a2a40',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(79, 142, 247, 0.08)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            flexShrink: 0,
                            background: sev === 'critical' ? '#ff6e6e' : sev === 'high' ? '#ffaa55' : '#73b8ff',
                            boxShadow: sev === 'critical' ? '0 0 8px #ff6e6e' : 'none'
                          }}
                        />

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ color: '#f1f5fb', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {event.title}
                            </strong>
                            <span className={`soc-badge ${sev}`}>{sev}</span>
                            {event.campaign_id && (
                              <span className="soc-badge info" style={{ fontSize: 10 }}>
                                Cluster {event.campaign_id}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, color: '#7a91ad', fontSize: 12 }}>
                            <span>Tenant: <strong style={{ color: '#cbd7e6' }}>{event.tenant_id}</strong></span>
                            <span>•</span>
                            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{event.event_type}</span>
                            {event.risk_score != null && (
                              <>
                                <span>•</span>
                                <span style={{ color: sev === 'critical' ? '#ff857f' : '#ffb977' }}>
                                  Score: {event.risk_score}/70
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <span style={{ color: '#687e9c', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
                          {formatRelativeTime(event.receivedAt, currentTime)}
                        </span>
                        <span style={{ color: '#5599ff', fontSize: 12, fontWeight: 700 }}>Inspect →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Slide-over Event Drawer */}
        {selectedEvent && (
          <div className="soc-drawer-backdrop" onClick={() => setSelectedEvent(null)}>
            <div className="soc-drawer" onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid #1e2f47',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#090e18'
                }}
              >
                <div>
                  <span className="soc-badge info" style={{ marginBottom: 4 }}>
                    {selectedEvent.event_type}
                  </span>
                  <h3 style={{ margin: '6px 0 0', color: '#f1f5fb', fontSize: 16 }}>
                    Threat Signal Inspection
                  </h3>
                </div>
                <button
                  type="button"
                  className="soc-copy-btn"
                  onClick={() => setSelectedEvent(null)}
                  style={{ padding: '6px 12px', fontSize: 14 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <small style={{ color: '#7a91ad', textTransform: 'uppercase', fontSize: 10, fontWeight: 700, letterSpacing: 0.8 }}>
                    Event Title
                  </small>
                  <div style={{ color: '#f1f5fb', fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                    {selectedEvent.title}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <div className="soc-card" style={{ padding: 14, background: '#090e18' }}>
                    <small style={{ color: '#7a91ad', fontSize: 10, textTransform: 'uppercase' }}>Severity</small>
                    <div style={{ marginTop: 4 }}>
                      <span className={`soc-badge ${selectedEvent.severity || 'high'}`}>
                        {selectedEvent.severity || 'high'}
                      </span>
                    </div>
                  </div>

                  <div className="soc-card" style={{ padding: 14, background: '#090e18' }}>
                    <small style={{ color: '#7a91ad', fontSize: 10, textTransform: 'uppercase' }}>Risk Score</small>
                    <div style={{ color: '#f1f5fb', fontSize: 16, fontWeight: 800, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
                      {selectedEvent.risk_score ?? 'N/A'} / 70
                    </div>
                  </div>

                  <div className="soc-card" style={{ padding: 14, background: '#090e18' }}>
                    <small style={{ color: '#7a91ad', fontSize: 10, textTransform: 'uppercase' }}>Source Tenant</small>
                    <div style={{ color: '#cbd7e6', fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                      {selectedEvent.tenant_id}
                    </div>
                  </div>

                  <div className="soc-card" style={{ padding: 14, background: '#090e18' }}>
                    <small style={{ color: '#7a91ad', fontSize: 10, textTransform: 'uppercase' }}>Recorded At</small>
                    <div style={{ color: '#cbd7e6', fontSize: 12, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
                      {selectedEvent.timestamp ? selectedEvent.timestamp.slice(0, 19).replace('T', ' ') : 'N/A'}
                    </div>
                  </div>
                </div>

                {selectedEvent.campaign_id && (
                  <div style={{ padding: 16, background: 'rgba(79, 142, 247, 0.1)', border: '1px solid rgba(79, 142, 247, 0.3)', borderRadius: 10 }}>
                    <strong style={{ color: '#8eccff', display: 'block', fontSize: 13 }}>
                      Correlated Active Campaign
                    </strong>
                    <p style={{ color: '#cbd7e6', fontSize: 12, margin: '4px 0 10px' }}>
                      This indicator matches cross-tenant campaign cluster: {selectedEvent.campaign_id}
                    </p>
                    <Link
                      href={`/campaigns/${encodeURIComponent(selectedEvent.campaign_id)}`}
                      className="btn-primary"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      View Campaign Cluster Evidence →
                    </Link>
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <small style={{ color: '#7a91ad', textTransform: 'uppercase', fontSize: 10, fontWeight: 700, letterSpacing: 0.8 }}>
                      Raw JSON Telemetry
                    </small>
                    <button
                      type="button"
                      className="soc-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedEvent.data, null, 2));
                      }}
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre
                    style={{
                      background: '#070b12',
                      border: '1px solid #1e2f47',
                      borderRadius: 8,
                      padding: 14,
                      color: '#a5b9d4',
                      fontSize: 12,
                      fontFamily: '"JetBrains Mono", Consolas, monospace',
                      overflowX: 'auto',
                      maxHeight: 280,
                      margin: 0
                    }}
                  >
                    {JSON.stringify(selectedEvent.data || selectedEvent, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
