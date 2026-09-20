from __future__ import annotations

import csv
import ipaddress
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.config import GEOLOCATION_URL, IP_INTELLIGENCE_PATH


@dataclass(frozen=True)
class GeoIntel:
	source_ip: str
	country: str | None = None
	region: str | None = None
	city: str | None = None
	asn: str | None = None
	is_vpn_proxy: bool = False
	confidence: float = 0.0


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
				except (KeyError, ValueError):
					continue
	except OSError:
		return None
	return None


async def enrich_ip(source_ip: str | None) -> GeoIntel | None:
	address = _public_ip(source_ip)
	if address is None:
		return None

	local = _dataset_lookup(address) or {}
	result = {
		"country": local.get("country"),
		"region": local.get("region"),
		"city": local.get("city"),
		"asn": local.get("asn"),
		"is_vpn_proxy": local.get("is_vpn_proxy", "false").lower() == "true",
		"confidence": 0.85 if local else 0.0,
	}
	try:
		async with httpx.AsyncClient(timeout=1.5) as client:
			response = await client.get(f"{GEOLOCATION_URL.rstrip('/')}/{address}")
			response.raise_for_status()
			data = response.json()
			if data.get("success", True):
				connection = data.get("connection") or {}
				security = data.get("security") or {}
				result.update({
					"country": data.get("country") or result["country"],
					"region": data.get("region") or result["region"],
					"city": data.get("city") or result["city"],
					"asn": str(connection.get("asn")) if connection.get("asn") else result["asn"],
					"is_vpn_proxy": bool(security.get("vpn") or security.get("proxy") or security.get("tor") or result["is_vpn_proxy"]),
					"confidence": 0.75 if result["confidence"] == 0 else result["confidence"],
				})
	except (httpx.HTTPError, ValueError):
		pass

	if not any(result[key] for key in ("country", "region", "city", "asn")) and not result["is_vpn_proxy"]:
		return None
	return GeoIntel(source_ip=str(address), **result)


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