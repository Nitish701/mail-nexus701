# Mail-Nexus

Mail-Nexus is a multi-tenant email threat-analysis platform for detecting phishing,
malicious attachments, and coordinated campaigns across educational institutions.
It combines email authentication checks, deterministic heuristics, machine learning,
YARA scanning, threat intelligence, privacy-aware fingerprinting, and campaign
correlation in one demonstrable workflow.

This README is written for the SIH evaluation team: it explains what to run, what to
observe, and how one suspicious email becomes an actionable security report.

## What problem it solves

Traditional mail filtering can flag an individual message but often leaves analysts
to manually connect related messages. Mail-Nexus provides two purpose-specific views:

- **College Security Portal:** institution-scoped email investigations, reports, and
   threat handling.
- **Central Security and Correlation SOC:** cross-tenant campaign detection, live
   correlation, and security operations monitoring.

The portals remain separate applications with separate navigation and deployment
boundaries. They share the analysis backend, but a college operator sees their own
institutional scope while the central SOC sees correlated campaign intelligence.

## End-to-end workflow

```text
Email received
      -> Cloudflare Email Worker forwards raw RFC822
      -> FastAPI parses and identifies the tenant
      -> Layer 1: SPF, DKIM, and sender alignment
      -> Layer 2: language, URL, and attachment heuristics
      -> Layer 3: TF-IDF + XGBoost body model (lexical fallback available)
      -> Layer 4: YARA rules and optional VirusTotal lookup
      -> PII-safe fingerprint, SHA-256/TLSH, and IOC extraction
      -> Cross-tenant campaign correlation
      -> JSON, CSV, Markdown, or HTML threat report
```

Each layer contributes explainable findings and a score. The result is persisted with
a report ID so an evaluator can reproduce the scan, inspect the evidence, and download
the same report in multiple formats.

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

## Repository layout

| Path | Responsibility |
| --- | --- |
| `backend/app/main.py` | FastAPI application and email ingestion workflow |
| `backend/app/engine/` | Authentication, heuristics, ML, YARA, and MIME parsing |
| `backend/app/fingerprint/` | PII sanitization, hashes, TLSH, and IOC fingerprints |
| `backend/app/developer2/` | Tenant, campaign, correlation, and live-feed APIs |
| `backend/app/reports/` | Report listing, generation, and downloads |
| `frontend/college/` | Institution-facing Next.js portal on port 3000 |
| `frontend/central/` | Central SOC Next.js portal on port 3001 |
| `cloudflare_worker/` | Production email forwarding Worker |
| `cloudflared/` | Named tunnel configuration for local backend exposure |
| `backend/test_samples/` | Reproducible suspicious-email sample |

## Quick start for evaluators

### 1. Start the backend

PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The API is available at `http://127.0.0.1:8000`. Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

### 2. Run the reproducible smoke test

In a second terminal, with the backend dependencies available:

```powershell
cd backend
python test_reports_smoke.py
```

The test submits a suspicious RFC822 message and verifies ingestion, scoring, report
persistence, report retrieval, and JSON/CSV/Markdown/HTML downloads. No external API
key or network service is required for this test.

### 3. Start the two portals

```powershell
cd frontend
npm install
npm run dev:college
```

In another terminal:

```powershell
cd frontend
npm run dev:central
```

Open `http://localhost:3000` for the College Portal and `http://localhost:3001` for
the Central SOC. The frontend API configuration is documented in each app's
`.env.example` file.

## Evaluation walkthrough

1. Open the College Portal and verify the institution-scoped navigation.
2. Submit `backend/test_samples/suspicious-phishing-test.eml` to
   `POST /api/v1/inbound` with `Content-Type: message/rfc822`.
3. Inspect the response score, authentication results, heuristic findings, ML result,
   static scan result, fingerprint, and generated `report_id`.
4. Open `/api/reports/{report_id}` and download the report in all four formats.
5. Open the Central SOC to review campaigns, live feed, threat intelligence, and
   system health views.
6. Register an organization with `POST /api/organizations`, then verify its domain
   with `POST /api/organizations/verify-domain` to demonstrate tenant separation.

Example local ingestion command:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/v1/inbound `
  -Method Post -ContentType "message/rfc822" `
  -InFile .\backend\test_samples\suspicious-phishing-test.eml
```

## API surface

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

### Ingestion and health

- `GET /health`
- `POST /webhooks/email`
- `POST /api/v1/inbound`

### Tenant and correlation

- `POST /api/organizations`
- `GET /api/organizations`
- `POST /api/organizations/verify-domain`
- `GET /api/developer2/health`
- `POST /api/developer2/fingerprints`
- `GET /api/developer2/campaigns`
- `GET /api/developer2/campaigns/{campaign_id}`
- `WS /api/developer2/ws/live-feed`

### Reports

- `GET /api/reports` - list reports, optionally filtered by `email` or `campaign`
- `GET /api/reports/{report_id}` - retrieve structured report JSON
- `GET /api/reports/{report_id}/download?format=json|csv|md|html` - download a report
- `POST /api/reports/campaign/{campaign_id}` - generate a campaign report
- `DELETE /api/reports/{report_id}` - delete a stored report

## Public deployment

From the repository root, start the backend, both frontends, and the named tunnel:

```powershell
.\start-public.ps1
```

The public portals are `https://mail.edushield1.in` and `https://soc.edushield1.in`.
Inbound Cloudflare email is delivered by the Worker to
`https://api.edushield1.in/webhooks/email`, which the tunnel forwards to the local
backend on port `8000`. Deploy the Worker from `cloudflare_worker` with
`wrangler deploy` before sending a real email.

Smoke test for the reporting feature (no network required):

```powershell
python test_reports_smoke.py
```

The included `start-public.ps1` launcher starts the backend, both Next.js portals,
and the Cloudflare tunnel. It expects `cloudflared` on `PATH` and a configured
Cloudflare account. Deploy the Worker from `cloudflare_worker` with `wrangler deploy`
before sending real email. Do not commit tunnel credentials, API keys, or production
secrets.

## Configuration

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

Optional integrations fail gracefully to deterministic local behavior where possible,
so the core demonstration remains reproducible without VirusTotal, Redis, Groq, Ollama,
Cloudflare, or a trained model service.

## Security and privacy notes

- Webhook requests can require a Bearer secret via `WEBHOOK_SECRET`.
- Email payloads are size-limited to 25 MiB and malformed MIME is rejected.
- PII is sanitized before fingerprints are used for correlation.
- Organization and domain routing prevents unrelated tenant data from being mixed.
- Production deployments must use HTTPS, restricted CORS origins, secret management,
   and a production database instead of default local SQLite.

## Current scope and limitations

- The default local setup uses SQLite for evaluator convenience.
- VirusTotal, Redis, Groq/Ollama, Cloudflare Email Routing, and the named tunnel are
   optional production integrations.
- The included model and YARA rules are starter assets intended for a working demo;
   production deployments should retrain and review them against representative data.