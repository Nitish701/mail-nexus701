# IP intelligence dataset

`ip_intelligence.csv` is an optional local CIDR override list used by Developer 2 geolocation enrichment.

Columns:

```text
cidr,country,region,city,asn,is_vpn_proxy,provider
```

The checked-in list was converted from the public Proxifly free proxy list:

`https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/data.csv`

These entries identify public proxy endpoints, not every VPN exit node. Review the source license and refresh the file regularly. Do not treat this list as proof of abuse: it is only supporting evidence.

For IPs not present locally, the service queries `GEOLOCATION_URL` (default:
`https://ipwho.is`) for approximate country, region, city, ASN, and VPN/proxy/tor
indicators. When `IPINFO_TOKEN` is configured, IPinfo is also queried for ASN,
network ownership, and available privacy/network-type details. IPinfo credentials
are optional, and account plans may restrict available fields or request volume;
the existing `GEOLOCATION_URL` provider remains the fallback for approximate
geolocation. No new paid dependency is introduced.

Only a public IP found in the topmost `Received` header from a configured trusted
receiving MTA is enriched. Set `MAIL_NEXUS_TRUSTED_RECEIVED_HOSTS` to a comma-separated
list of exact `by` hostnames controlled by the receiving service. If the topmost
hop is not trusted, or no public peer address is present, the sender-side IP is
reported as unavailable rather than guessed from `Received`, `X-Originating-IP`,
or proxy headers. Private, loopback, and non-global addresses are never sent to
external services. Provider timeouts and rate limits do not block email processing.
