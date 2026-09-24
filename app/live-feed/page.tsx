'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CENTRAL_NAV } from '../../lib/nav';

type FeedEvent = {
  id: string;
  time: string;
  type: string;
  message: string;
  severity?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LiveFeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        const wsUrl = API_URL.replace(/^http/, 'ws') + '/api/developer2/ws/live-feed';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setConnected(true);
          setError(null);
        };

        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            const event: FeedEvent = {
              id: String(data.id || data.event_id || Date.now()),
              time: String(data.timestamp || data.time || new Date().toISOString()),
              type: String(data.type || data.event_type || 'event'),
              message: String(data.message || data.summary || JSON.stringify(data)),
              severity: data.severity ? String(data.severity) : undefined
            };
            setEvents((prev) => [event, ...prev].slice(0, 100));
          } catch {
            setEvents((prev) => [
              {
                id: String(Date.now()),
                time: new Date().toISOString(),
                type: 'raw',
                message: String(evt.data)
              },
              ...prev
            ].slice(0, 100));
          }
        };

        ws.onerror = () => {
          setError('WebSocket connection error');
          setConnected(false);
        };

        ws.onclose = () => {
          setConnected(false);
          if (!closed) {
            setTimeout(connect, 3000);
          }
        };
      } catch {
        setError('Unable to open live feed WebSocket');
        setConnected(false);
      }
    };

    connect();

    return () => {
      closed = true;
      ws?.close();
    };
  }, []);

  return (
    <AppShell
      title="Live feed"
      subtitle="Real-time correlation events from the central engine"
      navItems={[...CENTRAL_NAV]}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          color: '#9fb5d8',
          fontSize: 13
        }}
      >
        <span
          className={`soc-status-dot ${connected ? 'live' : ''}`}
          style={{
            background: connected ? '#34d399' : '#f87171',
            boxShadow: connected ? '0 0 8px #34d399' : 'none'
          }}
        />
        {connected ? 'Connected to live feed' : 'Disconnected — retrying…'}
        {error ? <span style={{ color: '#fca5a5' }}> · {error}</span> : null}
      </div>

      {events.length === 0 ? (
        <div className="art-empty-state">
          Waiting for events… Open the WebSocket endpoint{' '}
          <code>/api/developer2/ws/live-feed</code> or wait for correlation activity.
        </div>
      ) : (
        <div
          style={{
            background: '#0b1523',
            border: '1px solid #243b5b',
            borderRadius: 12,
            overflow: 'hidden'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#6e91ad', textAlign: 'left', background: '#0f1a28' }}>
                <th style={{ padding: '12px 16px' }}>Time</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Severity</th>
                <th style={{ padding: '12px 16px' }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} style={{ borderTop: '1px solid #1d344b' }}>
                  <td style={{ padding: '12px 16px', color: '#8aa4bf', whiteSpace: 'nowrap' }}>
                    {e.time}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#c5d8ef' }}>{e.type}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {e.severity ? (
                      <span
                        className={`severity-pill severity-${String(e.severity).toLowerCase()}`}
                      >
                        {e.severity}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#e5f0ff', overflowWrap: 'anywhere' }}>
                    {e.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
