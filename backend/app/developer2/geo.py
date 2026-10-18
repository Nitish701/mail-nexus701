from __future__ import annotations

import asyncio
import csv
import ipaddress
import logging
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.config import GEOLOCATION_TIMEOUT_SECONDS, GEOLOCATION_URL, IPINFO_TOKEN, IP_INTELLIGENCE_PATH


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GeoIntel:
	source_ip: str
	country: str | None = None
	region: str | None = None
	city: str | None = None
	asn: str | None = None
	network_owner: str | None = None
	is_vpn_proxy: bool = False
	confidence: float = 0.0
	internal_relay: bool = False
	origin_type: str = "unknown_origin"
	location_is_infrastructure: bool = False


def _public_ip(value: str | None) -> ipaddress._BaseAddress | None:
	if not value:
		return None
	try:
		address = ipaddress.ip_address(value.strip())
	except ValueError:
		return None
	return address if address.is_global else None


def _dataset_lookup(address: ipaddress._BaseAddress) -> dict[str, str] | None:
	if not IP_INTELLIGENCE_PATH.exists():
		return None
	try:
		with IP_INTELLIGENCE_PATH.open(newline="", encoding="utf-8") as dataset:
			for row in csv.DictReader(dataset):
				try:
					if address in ipaddress.ip_network(row["cidr"].strip()):
						return row
				except (AttributeError, KeyError, TypeError, ValueError):
					continue
	except OSError:
		return None
	return None


async def _request_json(url: str, params: dict[str, str] | None = None) -> dict[str, object] | None:
	try:
		async with httpx.AsyncClient(timeout=GEOLOCATION_TIMEOUT_SECONDS) as client:
			response = await client.get(url, params=params)
			if response.status_code == 429:
				logger.warning("Geolocation provider rate limit reached")
				return None
			response.raise_for_status()
			data = response.json()
	except httpx.TimeoutException:
		logger.warning("Geolocation provider timed out")
		return None
	except httpx.InvalidURL:
		logger.warning("Geolocation provider URL is invalid")
		return None
	except httpx.HTTPError as error:
		logger.warning("Geolocation provider request failed (%s)", type(error).__name__)
		return None
	except ValueError:
		logger.warning("Geolocation provider returned invalid JSON")
		return None
	if not isinstance(data, dict):
		logger.warning("Geolocation provider returned an unexpected response")
		return None
	return data


def _network_classification(
	owner: object,
	network_type: object,
	is_vpn_proxy: bool,
) -> tuple[str, bool]:
	normalized_owner = str(owner or "").casefold()
	normalized_type = str(network_type or "").casefold()
	if "cloudflare" in normalized_owner or "as13335" in normalized_owner:
		return "cloudflare_proxy", True
	if any(provider in normalized_owner for provider in (
		"google", "gmail", "microsoft", "outlook", "yahoo", "yandex",
		"proofpoint", "mimecast", "fastmail", "proton", "zoho", "amazon ses",
	)):
		return "email_provider_infrastructure", True
	if is_vpn_proxy:
		return "vpn_or_hosting", True
	if normalized_type == "hosting":
		return "vpn_or_hosting", True
	if normalized_type == "isp":
		return "sender_side_isp", False
	return "unknown_origin", False


def _text_value(value: object) -> str | None:
	return value.strip() or None if isinstance(value, str) else None


async def enrich_ip(source_ip: str | None) -> GeoIntel | None:
	address = _public_ip(source_ip)
	if address is None:
		return None

	local = _dataset_lookup(address) or {}
	lookups = [
		_request_json(f"{GEOLOCATION_URL.rstrip('/')}/{address}"),
	]
	if IPINFO_TOKEN:
		lookups.append(_request_json(f"https://ipinfo.io/{address}/json", {"token": IPINFO_TOKEN}))
	results = await asyncio.gather(*lookups)
	geo_data = results[0]
	ipinfo_data = results[1] if len(results) > 1 else None
	result = {
		"country": _text_value(local.get("country")),
		"region": _text_value(local.get("region")),
		"city": _text_value(local.get("city")),
		"asn": _text_value(local.get("asn")),
		"network_owner": _text_value(local.get("provider")),
		"is_vpn_proxy": (_text_value(local.get("is_vpn_proxy")) or "false").lower() == "true",
		"confidence": 0.85 if local else 0.0,
	}
	if geo_data and geo_data.get("success", True):
		connection = geo_data.get("connection") or {}
		security = geo_data.get("security") or {}
		if isinstance(connection, dict) and isinstance(security, dict):
			result.update({
				"country": _text_value(geo_data.get("country")) or result["country"],
				"region": _text_value(geo_data.get("region")) or result["region"],
				"city": _text_value(geo_data.get("city")) or result["city"],
				"asn": _text_value(connection.get("asn")) or result["asn"],
				"network_owner": _text_value(connection.get("org")) or _text_value(connection.get("isp")) or result["network_owner"],
				"is_vpn_proxy": bool(security.get("vpn") or security.get("proxy") or security.get("tor") or result["is_vpn_proxy"]),
				"confidence": 0.75 if result["confidence"] == 0 else result["confidence"],
			})
	if ipinfo_data:
		ipinfo_asn = ipinfo_data.get("asn") or {}
		ipinfo_company = ipinfo_data.get("company") or {}
		ipinfo_privacy = ipinfo_data.get("privacy") or {}
		if not all(isinstance(section, dict) for section in (ipinfo_asn, ipinfo_company, ipinfo_privacy)):
			ipinfo_asn, ipinfo_company, ipinfo_privacy = {}, {}, {}
		result.update({
			"country": result["country"] or _text_value(ipinfo_data.get("country")),
			"region": result["region"] or _text_value(ipinfo_data.get("region")),
			"city": result["city"] or _text_value(ipinfo_data.get("city")),
			"asn": _text_value(ipinfo_asn.get("asn")) or result["asn"],
			"network_owner": _text_value(ipinfo_asn.get("name")) or _text_value(ipinfo_data.get("org")) or _text_value(ipinfo_company.get("name")) or result["network_owner"],
			"is_vpn_proxy": bool(ipinfo_privacy.get("vpn") or ipinfo_privacy.get("proxy") or ipinfo_privacy.get("tor") or ipinfo_privacy.get("relay") or result["is_vpn_proxy"]),
			"confidence": 0.75 if result["confidence"] == 0 else result["confidence"],
		})

	network_type = None
	if ipinfo_data:
		ipinfo_asn = ipinfo_data.get("asn") or {}
		ipinfo_company = ipinfo_data.get("company") or {}
		if isinstance(ipinfo_asn, dict):
			network_type = ipinfo_asn.get("type")
		if not network_type and isinstance(ipinfo_company, dict):
			network_type = ipinfo_company.get("type")
	origin_type, location_is_infrastructure = _network_classification(
		result["network_owner"],
		network_type,
		result["is_vpn_proxy"],
	)
	if not any(result[key] for key in ("country", "region", "city", "asn", "network_owner")) and not result["is_vpn_proxy"]:
		return None
	return GeoIntel(
		source_ip=str(address),
		origin_type=origin_type,
		location_is_infrastructure=location_is_infrastructure,
		**result,
	)


def private_relay_note(private_ips: list[str]) -> dict[str, object]:
	return {"internal_relay": bool(private_ips), "private_ips": private_ips, "note": "Private relay hop requires organization-side verification." if private_ips else None}


def location_note(geo: GeoIntel | None, source_ip: str | None) -> str:
	if geo:
		return "Approximate network location only; it does not verify the sender's physical location."
	if source_ip:
		return "A trusted public IP was observed, but no geolocation intelligence was available; location was not inferred."
	return "No reliable sender-side IP evidence was available; no location was inferred."


def geo_match(current: GeoIntel | object, candidate: object) -> tuple[bool, float]:
	current_country = getattr(current, "geo_country", None)
	candidate_country = getattr(candidate, "geo_country", None)
	if not current_country or not candidate_country:
		return False, 0.0
	if current_country.casefold() != candidate_country.casefold():
		return False, 0.0
	region_match = bool(getattr(current, "geo_region", None) and getattr(candidate, "geo_region", None) and current.geo_region.casefold() == candidate.geo_region.casefold())
	vpn_match = getattr(current, "is_vpn_proxy", None) == getattr(candidate, "is_vpn_proxy", None)
	return True, 0.15 + (0.10 if region_match else 0.0) + (0.05 if vpn_match else 0.0)