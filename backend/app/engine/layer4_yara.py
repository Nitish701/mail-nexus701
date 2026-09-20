from __future__ import annotations

import asyncio
import hashlib
from dataclasses import dataclass
from pathlib import Path
import time
from typing import Any

import httpx

from app.config import ATTACHMENT_SCAN_DIR, REDIS_URL, VIRUSTOTAL_API_KEY, VIRUSTOTAL_URL, YARA_RULES_DIR
from app.engine.parser import ParsedAttachment


LOCAL_CACHE_TTL_SECONDS = 3600
_local_virus_total_cache: dict[str, tuple[float, str]] = {}
_compiled_rule_set: Any = None
_rules_initialized = False


@dataclass
class StaticScanResult:
	status: str
	score: int
	findings: list[str]
	virus_total: dict[str, Any]


def _compile_rules() -> Any:
	global _compiled_rule_set, _rules_initialized
	if _rules_initialized:
		return _compiled_rule_set
	_rules_initialized = True
	rule_files = {path.stem: str(path) for path in YARA_RULES_DIR.glob("*.yar")}
	if not rule_files:
		return None

	try:
		import yara
	except ImportError:
		return None

	try:
		_compiled_rule_set = yara.compile(filepaths=rule_files)
		return _compiled_rule_set
	except Exception:
		return None


_compile_rules()


def _scan_attachment(rule_set: Any, attachment: ParsedAttachment) -> list[str]:
	if rule_set is None:
		return []
	return [match.rule for match in rule_set.match(data=attachment.payload)]


async def _redis_client() -> Any:
	try:
		from redis.asyncio import from_url

		client = from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=0.05, socket_timeout=0.05)
		await client.ping()
		return client
	except Exception:
		return None


async def _virustotal_lookup(digests: list[str]) -> dict[str, Any]:
	if not VIRUSTOTAL_API_KEY or not digests:
		return {}
	client = await _redis_client()
	results: dict[str, Any] = {}
	try:
		async with httpx.AsyncClient(timeout=0.08) as http_client:
			for digest in digests:
				cache_key = f"mail-nexus:virustotal:{digest}"
				cached = await client.get(cache_key) if client else None
				if cached is None:
					local_cached = _local_virus_total_cache.get(digest)
					if local_cached and local_cached[0] > time.monotonic():
						cached = local_cached[1]
				if cached:
					results[digest] = cached
					continue
				try:
					response = await http_client.get(f"{VIRUSTOTAL_URL}/{digest}", headers={"x-apikey": VIRUSTOTAL_API_KEY})
				except httpx.HTTPError:
					continue
				if response.is_success:
					value = response.text
					results[digest] = value
					_local_virus_total_cache[digest] = (time.monotonic() + LOCAL_CACHE_TTL_SECONDS, value)
					if client:
						await client.setex(cache_key, 3600, value)
	finally:
		if client:
			await client.aclose()
	return results


async def scan_attachments(attachments: list[ParsedAttachment]) -> StaticScanResult:
	rule_set = await asyncio.to_thread(_compile_rules)
	findings: list[str] = []
	digests: list[str] = []
	for attachment in attachments:
		digest = hashlib.sha256(attachment.payload).hexdigest()
		digests.append(digest)
		matches = await asyncio.to_thread(_scan_attachment, rule_set, attachment)
		findings.extend(f"YARA match: {match}" for match in matches)

	try:
		virus_total = await asyncio.wait_for(_virustotal_lookup(digests), timeout=0.05)
	except asyncio.TimeoutError:
		virus_total = {}
	if virus_total:
		findings.append("VirusTotal result available")
	return StaticScanResult(
		status="suspicious" if findings else "pass",
		score=min(len(findings) * 20, 30),
		findings=list(dict.fromkeys(findings)),
		virus_total=virus_total,
	)
