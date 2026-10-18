# Cloudflare Email Worker

The Worker forwards each incoming email's raw RFC 822/MIME stream to:

```text
POST ${WEBHOOK_URL}/webhooks/email
Content-Type: message/rfc822
```

Configure the Worker before deployment. `WEBHOOK_URL` is a Worker variable and must point to
the public API hostname; `WEBHOOK_SECRET` is optional but must match the backend environment if
the backend is configured to require it:

```powershell
wrangler secret put WEBHOOK_SECRET
wrangler deploy
```

The committed `wrangler.toml` already sets `WEBHOOK_URL = "https://api.edushield1.in"`.
Deploy the Worker from `cloudflare_worker` after the tunnel is running and verify delivery with
the API health endpoint:

```powershell
Invoke-WebRequest https://api.edushield1.in/health
```

Run the local webhook through the named tunnel after replacing the placeholders in `cloudflared/config.yml`:

```powershell
cloudflared tunnel --config cloudflared/config.yml run
```

The local webhook must listen on `http://localhost:8000` and accept the raw request body without JSON parsing.

## Size limitations

- **Backend limit:** The Mail-Nexus backend accepts raw email payloads up to **50 MiB (52,428,800 bytes)** via direct API ingestion (`/api/v1/inbound` or `/webhooks/email`).
- **Cloudflare Email Routing restriction:** Cloudflare Email Routing enforces a platform-level limit of **25 MB** on incoming SMTP emails before invoking the Worker. Emails exceeding 25 MB delivered via SMTP are rejected upstream by Cloudflare. Direct webhook/API submissions to the backend are not subject to this 25 MB SMTP limit and can utilize the full 50 MiB capacity.