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