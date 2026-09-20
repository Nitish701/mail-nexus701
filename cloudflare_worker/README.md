# Cloudflare Email Worker

The Worker forwards each incoming email's raw RFC 822/MIME stream to:

```text
POST ${WEBHOOK_URL}/webhooks/email
Content-Type: message/rfc822
```

Configure the Worker secrets before deployment:

```powershell
wrangler secret put WEBHOOK_URL
wrangler secret put WEBHOOK_SECRET
wrangler deploy
```

Run the local webhook through the named tunnel after replacing the placeholders in `cloudflared/config.yml`:

```powershell
cloudflared tunnel --config cloudflared/config.yml run
```

The local webhook must listen on `http://localhost:8000` and accept the raw request body without JSON parsing.