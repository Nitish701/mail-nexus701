# IP intelligence dataset

`ip_intelligence.csv` is an optional local CIDR override list used by Developer 2 geolocation enrichment.

Columns:

```text
cidr,country,region,city,asn,is_vpn_proxy,provider
```

The checked-in list was converted from the public Proxifly free proxy list:

`https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/data.csv`

These entries identify public proxy endpoints, not every VPN exit node. Review the source license and refresh the file regularly. Do not treat this list as proof of abuse: it is only supporting evidence.

For IPs not present locally, the service queries `GEOLOCATION_URL` (default: `https://ipwho.is`) for approximate country, region, city, ASN, and VPN/proxy/tor indicators. Private, loopback, and non-global addresses are never sent to the external service.
