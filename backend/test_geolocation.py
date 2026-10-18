import httpx
import pytest

from app.developer2 import geo
from app.engine import parser


def test_proxy_and_originating_headers_are_not_ip_evidence(monkeypatch):
	monkeypatch.setattr(parser, "TRUSTED_RECEIVED_HOSTS", set())
	source_ip, private_ips = parser._extract_source_ips({
		"cf-connecting-ip": ["1.1.1.1"],
		"x-forwarded-for": ["8.8.8.8"],
		"x-originating-ip": ["9.9.9.9"],
		"received": ["from sender.example ([4.4.4.4]) by mx.example"],
	})
	assert source_ip is None
	assert private_ips == []


def test_only_topmost_received_from_trusted_mta_is_used(monkeypatch):
	monkeypatch.setattr(parser, "TRUSTED_RECEIVED_HOSTS", {"mx.example"})
	source_ip, private_ips = parser._extract_source_ips({
		"received": [
			"from sender.example ([8.8.8.8]) by mx.example",
			"from forged.example ([1.1.1.1]) by mx.example",
		],
		"x-originating-ip": ["9.9.9.9"],
	})
	assert source_ip == "8.8.8.8"
	assert private_ips == []


def test_does_not_fall_through_untrusted_topmost_received(monkeypatch):
	monkeypatch.setattr(parser, "TRUSTED_RECEIVED_HOSTS", {"mx.example"})
	source_ip, private_ips = parser._extract_source_ips({
		"received": [
			"from sender.example ([8.8.8.8]) by untrusted.example",
			"from relay.example ([1.1.1.1]) by mx.example",
		],
	})
	assert source_ip is None
	assert private_ips == []


def test_invalid_and_private_received_addresses_are_rejected(monkeypatch):
	monkeypatch.setattr(parser, "TRUSTED_RECEIVED_HOSTS", {"mx.example"})
	source_ip, private_ips = parser._extract_source_ips({
		"received": ["from sender.example ([300.2.3.4]) by mx.example"],
	})
	assert source_ip is None
	assert private_ips == []

	source_ip, private_ips = parser._extract_source_ips({
		"received": ["from sender.example ([10.0.0.2]) by mx.example"],
	})
	assert source_ip is None
	assert private_ips == ["10.0.0.2"]


def test_trusted_received_supports_ipv6_literals(monkeypatch):
	monkeypatch.setattr(parser, "TRUSTED_RECEIVED_HOSTS", {"mx.example"})
	source_ip, private_ips = parser._extract_source_ips({
		"received": ["from sender.example ([IPv6:2001:4860:4860::8888]) by mx.example"],
	})
	assert source_ip == "2001:4860:4860::8888"
	assert private_ips == []


@pytest.mark.asyncio
async def test_invalid_and_cloudflare_ips_are_handled(monkeypatch):
	calls = []

	async def lookup(url, params=None):
		assert url.startswith("https://")
		calls.append(url)
		return {"country": "US", "asn": {"asn": "AS13335", "name": "Cloudflare, Inc.", "type": "hosting"}}

	monkeypatch.setattr(geo, "_request_json", lookup)
	assert await geo.enrich_ip("not-an-ip") is None
	assert calls == []

	monkeypatch.setattr(geo, "IPINFO_TOKEN", "test-token")
	result = await geo.enrich_ip("1.1.1.1")
	assert result is not None
	assert result.source_ip == "1.1.1.1"
	assert result.origin_type == "cloudflare_proxy"
	assert result.location_is_infrastructure is True


@pytest.mark.asyncio
async def test_ipinfo_and_existing_geo_provider_responses(monkeypatch):
	monkeypatch.setattr(geo, "IPINFO_TOKEN", "test-token")

	async def lookup(url, params=None):
		if "ipinfo.io" in url:
			assert params == {"token": "test-token"}
			return {
				"asn": {"asn": "AS7922", "name": "Comcast Cable", "type": "isp"},
				"country": "US",
			}
		return {
			"success": True,
			"country": "United States",
			"region": "California",
			"city": "San Francisco",
			"connection": {"asn": 7922, "isp": "Comcast Cable", "org": "Comcast"},
			"security": {"vpn": False, "proxy": False, "tor": False},
		}

	monkeypatch.setattr(geo, "_request_json", lookup)
	result = await geo.enrich_ip("8.8.8.8")
	assert result is not None
	assert result.country == "United States"
	assert result.region == "California"
	assert result.city == "San Francisco"
	assert result.asn == "AS7922"
	assert result.network_owner == "Comcast Cable"
	assert result.origin_type == "sender_side_isp"


@pytest.mark.asyncio
async def test_provider_timeout_does_not_interrupt_enrichment(monkeypatch):
	monkeypatch.setattr(geo, "IPINFO_TOKEN", None)

	class TimeoutClient:
		def __init__(self, **kwargs):
			assert kwargs["timeout"] == geo.GEOLOCATION_TIMEOUT_SECONDS

		async def __aenter__(self):
			return self

		async def __aexit__(self, _exc_type, _exc, _tb):
			return None

		async def get(self, url, params=None):
			assert url.startswith("https://")
			assert params is None
			raise httpx.TimeoutException("request timed out")

	monkeypatch.setattr(geo.httpx, "AsyncClient", TimeoutClient)
	assert await geo.enrich_ip("8.8.8.8") is None


@pytest.mark.asyncio
async def test_rate_limit_response_is_ignored(monkeypatch):
	class MockResponse:
		def __init__(self, status_code):
			self.status_code = status_code

		def raise_for_status(self):
			raise AssertionError("429 must not be retried or raised")

	class MockClient:
		def __init__(self, **kwargs):
			assert kwargs["timeout"] == geo.GEOLOCATION_TIMEOUT_SECONDS

		async def __aenter__(self):
			return self

		async def __aexit__(self, _exc_type, _exc, _tb):
			return None

		async def get(self, url, params=None):
			assert url.startswith("https://")
			return MockResponse(429)

	monkeypatch.setattr(geo.httpx, "AsyncClient", MockClient)
	assert await geo._request_json("https://ipwho.is/8.8.8.8") is None
