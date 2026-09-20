# Mail-Nexus

Multi-tenant email threat-analysis platform. Inbound email is ingested, scored
through a layered detection pipeline, fingerprinted, and correlated across
tenants into phishing campaigns. Generated threat reports can be exported.

## Separation model: College portal vs Central SOC

This repository contains one backend platform and two separately deployable product
frontends that must remain operationally distinct:

- Mail-Nexus College Security Portal: institution-scoped investigation and local
  threat handling.
- Mail-Nexus Central Security & Correlation SOC: cross-tenant campaign detection,
  live correlation and central intelligence monitoring.

The two UIs must not be combined into a single dashboard. They are separate
applications with separate navigation, permissions, environment configuration, and
backend endpoints. The backend may remain shared for the same repo, but each UI
must consciously represent its own authorization boundary.

## Architecture

```
Inbound email
   │
   ▼
Cloudflare Email Worker (cloudflare_worker/worker.js)
   │  POST ${WEBHOOK_URL}/webhooks/email   (raw message/rfc822, Bearer secret)
   ▼
cloudflared named tunnel (cloudflared/config.yml) → localhost:8000
   │
   ▼
FastAPI backend (backend/app/main.py)
   ├── Layer 1 Authentication   SPF / DKIM / From↔Return-Path alignment
   ├── Layer 2 Heuristics       phrasing, URL, attachment-extension signals
   ├── Layer 3 ML body model    TF-IDF + XGBoost (lexical fallback)
   ├── Layer 4 YARA + VirusTotal
   ├── Fingerprinting           PII redaction, SHA-256, TLSH, IOC list
   ├── LLM Threat Advisory      Ollama / Groq (deterministic fallback)
   └── Report generation        JSON / CSV / Markdown / HTML, persisted
```

## API

Ingestion (raw MIME body, `POST`):

- `POST /webhooks/email`
- `POST /api/v1/inbound`

Developer-2 correlation (SOC dashboard backend):

- `GET  /api/developer2/health`
- `POST /api/developer2/fingerprints`
- `GET  /api/developer2/campaigns`
- `GET  /api/developer2/campaigns/{campaign_id}`
- `WS   /api/developer2/ws/live-feed`

Reports:

- `GET    /api/reports` — list generated reports (filter by `report_type=email|campaign`)
- `GET    /api/reports/{report_id}` — structured report JSON
- `GET    /api/reports/{report_id}/download?format=json|csv|md|html` — download
- `POST   /api/reports/campaign/{campaign_id}` — generate a campaign report
- `DELETE /api/reports/{report_id}` — delete a stored report

Every successful scan response now includes a `report_id`, and the report is
persisted automatically (reporting never blocks ingestion).

## Running the backend

```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Smoke test for the reporting feature (no network required):

```powershell
python test_reports_smoke.py
```

## Configuration (environment variables)

| Variable | Purpose |
| --- | --- |
| `WEBHOOK_SECRET` | Shared secret required on the ingestion webhook |
| `MAIL_NEXUS_DATABASE_URL` | SQLAlchemy database URL (default SQLite) |
| `MAIL_NEXUS_MODEL_PATH` | Path to `body_model.joblib` |
| `MAIL_NEXUS_YARA_RULES_DIR` | Directory containing `*.yar` rules |
| `VIRUSTOTAL_API_KEY` | Enables VirusTotal lookups |
| `REDIS_URL` | VirusTotal result cache |
| `LLM_PROVIDER` | `ollama` (default) or `groq` |
| `GROQ_API_KEY` / `OLLAMA_URL` | Advisory provider credentials/endpoints |
| `MAIL_NEXUS_IP_INTELLIGENCE_PATH` | Local CIDR geo/VPN override CSV |