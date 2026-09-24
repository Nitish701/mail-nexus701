# Mail-Nexus Central SOC Frontend

Professional cross-tenant threat intelligence dashboard for the **Mail-Nexus Central Security & Correlation SOC**.

Separate from the College Security Portal — do not merge the two UIs.

## Highlights

- **Single Campaign center** — List + Graph combined (toggle in the top bar)
- **Professional correlation graph** — SVG topology with campaign · fingerprint · organization nodes, similarity edges, live selector
- **SOC Overview** — KPI hero, priority campaigns, indicator strip
- **Live Feed** — WebSocket stream
- **Investigations** — Prioritized queue
- **Threat Intelligence** — Federated IOCs
- **Tenants / Reports / System Health**

## Run

```bash
cd central-soc-frontend
cp .env.example .env.local
npm install
npm run dev
```

Default: **http://localhost:3001**

`NEXT_PUBLIC_API_URL` points at the FastAPI backend (default `http://localhost:8000`).

## API (read-only)

| Endpoint | Use |
| --- | --- |
| `GET /api/developer2/health` | Health |
| `GET /api/developer2/campaigns` | Campaigns |
| `GET /api/developer2/campaigns/{id}` | Detail |
| `WS  /api/developer2/ws/live-feed` | Live events |
| `GET /api/reports?...` | Suspicious reports |
| `GET /api/organizations` | Tenant metadata |

Backend and college portal are **not** modified by this package.
