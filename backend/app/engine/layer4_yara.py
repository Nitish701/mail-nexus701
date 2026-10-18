from __future__ import annotations

import asyncio
import hashlib
from dataclasses import dataclass
from io import BytesIO
import json
import logging
from pathlib import Path
import stat
import struct
import time
from typing import Any
import zipfile
import zlib

import httpx

from app.config import (
	ATTACHMENT_SCAN_DIR,
	REDIS_URL,
	VIRUSTOTAL_API_KEY,
	VIRUSTOTAL_TIMEOUT_SECONDS,
	VIRUSTOTAL_URL,
	ZIP_MAX_COMPRESSION_RATIO,
	ZIP_MAX_ENTRIES,
	ZIP_MAX_MEMBER_BYTES,
	ZIP_MAX_NESTED_DEPTH,
	ZIP_MAX_TOTAL_BYTES,
	YARA_RULES_DIR,
)
from app.engine.parser import ParsedAttachment


logger = logging.getLogger(__name__)
LOCAL_CACHE_TTL_SECONDS = 3600
_local_virus_total_cache: dict[str, tuple[float, str]] = {}
_compiled_rule_set: Any = None
_rules_initialized = False


@dataclass
class _ArchiveBudget:
	entries_remaining: int
	total_bytes_remaining: int
	coverage_findings: list[str]

	def report_partial(self, reason: str) -> None:
		self.coverage_findings.append(f"Archive not fully inspected: {reason}")


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


def _scan_bytes(rule_set: Any, payload: bytes) -> list[str]:
	if rule_set is None:
		return []
	return [match.rule for match in rule_set.match(data=payload)]


def _archive_kind(payload: bytes, filename: str | None) -> str | None:
	suffix = Path(filename or "").suffix.lower()
	has_zip_signature = payload.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"))
	if payload.startswith((b"Rar!\x1a\x07\x00", b"Rar!\x1a\x07\x01\x00")) or suffix == ".rar":
		return "rar"
	if payload.startswith(b"7z\xbc\xaf\x27\x1c") or suffix == ".7z":
		return "7z"
	try:
		if zipfile.is_zipfile(BytesIO(payload)):
			return "zip"
	except (EOFError, OSError, ValueError, zipfile.BadZipFile, zipfile.LargeZipFile, struct.error, zlib.error):
		if suffix == ".zip" or has_zip_signature:
			return "malformed_zip"
	if suffix == ".zip" or has_zip_signature:
		return "malformed_zip"
	return None


def _unsafe_zip_member(info: zipfile.ZipInfo) -> bool:
	name = info.filename
	windows_path = Path(name.replace("\\", "/"))
	normalized_parts = name.replace("\\", "/").split("/")
	windows_parts = name.split("\\")
	mode = (info.external_attr >> 16) & 0xFFFF
	return (
		not name
		or "\x00" in name
		or name.startswith(("/", "\\"))
		or windows_path.is_absolute()
		or any(part == ".." for part in normalized_parts + windows_parts)
		or bool(len(name) >= 2 and name[1] == ":")
		or stat.S_ISLNK(mode)
	)


def _scan_zip_members(
	payload: bytes,
	archive_name: str,
	rule_set: Any,
	budget: _ArchiveBudget,
	nesting_depth: int = 0,
	member_prefix: str = "",
) -> list[str]:
	findings: list[str] = []
	try:
		archive = zipfile.ZipFile(BytesIO(payload))
	except (
		EOFError,
		OSError,
		ValueError,
		zipfile.BadZipFile,
		zipfile.LargeZipFile,
		struct.error,
		zlib.error,
	) as error:
		budget.report_partial(f"{archive_name} is malformed or unreadable ({type(error).__name__})")
		return findings

	with archive:
		try:
			members = archive.infolist()
			for info in members:
				if budget.entries_remaining <= 0:
					budget.report_partial(f"entry limit reached in {archive_name}")
					break
				budget.entries_remaining -= 1

				member_name = f"{member_prefix}{info.filename}"
				if _unsafe_zip_member(info):
					budget.report_partial(f"suspicious ZIP member path or symlink skipped: {member_name}")
					continue
				if info.is_dir():
					continue
				if info.flag_bits & 0x1:
					budget.report_partial(f"encrypted ZIP member skipped: {member_name}")
					continue
				if info.file_size < 0 or info.compress_size < 0:
					budget.report_partial(f"invalid ZIP member sizes: {member_name}")
					continue
				if info.file_size > ZIP_MAX_MEMBER_BYTES:
					budget.report_partial(f"member size limit reached: {member_name}")
					continue
				ratio_limit = int(info.compress_size * ZIP_MAX_COMPRESSION_RATIO)
				if info.file_size > ratio_limit:
					budget.report_partial(f"compression ratio limit reached: {member_name}")
					continue
				if budget.total_bytes_remaining <= 0:
					budget.report_partial(f"total decompressed byte limit reached before {member_name}")
					break

				member_data = bytearray()
				max_member_read = min(
					ZIP_MAX_MEMBER_BYTES,
					budget.total_bytes_remaining,
					ratio_limit,
				)
				member_fully_read = False
				try:
					with archive.open(info) as member_stream:
						while True:
							remaining = max_member_read - len(member_data)
							if remaining <= 0:
								budget.report_partial(f"decompressed byte limit reached while reading {member_name}")
								break
							chunk = member_stream.read(min(64 * 1024, remaining))
							if not chunk:
								member_fully_read = True
								break
							member_data.extend(chunk)
							budget.total_bytes_remaining -= len(chunk)
				except (
					EOFError,
					NotImplementedError,
					OSError,
					RuntimeError,
					ValueError,
					zipfile.BadZipFile,
					zlib.error,
				) as error:
					budget.report_partial(f"could not read ZIP member {member_name} ({type(error).__name__})")
					continue

				if not member_fully_read:
					continue
				try:
					findings.extend(
						f"YARA match: {archive_name}!/{member_name}: {rule}"
						for rule in _scan_bytes(rule_set, bytes(member_data))
					)
				except Exception as error:
					budget.report_partial(f"YARA scan failed for {member_name} ({type(error).__name__})")
					continue

				nested_kind = _archive_kind(bytes(member_data), info.filename)
				if nested_kind == "zip":
					if nesting_depth >= ZIP_MAX_NESTED_DEPTH:
						budget.report_partial(f"nested archive depth limit reached at {member_name}")
					elif rule_set is None:
						budget.report_partial(f"YARA rules unavailable for nested archive {member_name}")
					else:
						findings.extend(
							_scan_zip_members(
								bytes(member_data),
								archive_name,
								rule_set,
								budget,
								nesting_depth + 1,
								f"{member_name}!/",
							)
						)
				elif nested_kind in {"rar", "7z"}:
					budget.report_partial(f"nested {nested_kind.upper()} archive not inspected: {member_name}")
				elif nested_kind == "malformed_zip":
					budget.report_partial(f"nested ZIP archive is malformed: {member_name}")
		except (
			EOFError,
			OSError,
			ValueError,
			zipfile.BadZipFile,
			zipfile.LargeZipFile,
			struct.error,
			zlib.error,
		) as error:
			budget.report_partial(f"{archive_name} could not be fully read ({type(error).__name__})")
	return findings


def _virustotal_findings(results: dict[str, Any]) -> list[str]:
	findings: list[str] = []
	for payload in results.values():
		try:
			document = json.loads(payload) if isinstance(payload, str) else payload
		except (json.JSONDecodeError, TypeError):
			continue
		if not isinstance(document, dict):
			continue
		data = document.get("data")
		attributes = data.get("attributes") if isinstance(data, dict) else None
		stats = attributes.get("last_analysis_stats") if isinstance(attributes, dict) else None
		if not isinstance(stats, dict):
			continue
		try:
			malicious = int(stats.get("malicious", 0) or 0)
			suspicious = int(stats.get("suspicious", 0) or 0)
		except (TypeError, ValueError):
			continue
		if malicious or suspicious:
			findings.append(f"VirusTotal detections: {malicious} malicious, {suspicious} suspicious")
	return findings


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
		async with httpx.AsyncClient(timeout=VIRUSTOTAL_TIMEOUT_SECONDS) as http_client:
			for digest in digests:
				cache_key = f"mail-nexus:virustotal:{digest}"
				try:
					cached = await client.get(cache_key) if client else None
				except Exception as error:
					logger.warning("VirusTotal cache lookup failed; using fallback cache/API: %s", error)
					cached = None
				if cached is None:
					local_cached = _local_virus_total_cache.get(digest)
					if local_cached and local_cached[0] > time.monotonic():
						cached = local_cached[1]
				if cached:
					results[digest] = cached
					continue
				try:
					response = await http_client.get(f"{VIRUSTOTAL_URL}/{digest}", headers={"x-apikey": VIRUSTOTAL_API_KEY})
				except httpx.HTTPError as error:
					logger.warning("VirusTotal request failed; continuing without lookup result: %s", error)
					continue
				if response.is_success:
					value = response.text
					results[digest] = value
					_local_virus_total_cache[digest] = (time.monotonic() + LOCAL_CACHE_TTL_SECONDS, value)
					if client:
						try:
							await client.setex(cache_key, 3600, value)
						except Exception as error:
							logger.warning("VirusTotal cache write failed; keeping the in-memory result: %s", error)
				else:
					logger.warning("VirusTotal returned HTTP %s; continuing without lookup result", response.status_code)
	finally:
		if client:
			try:
				await client.aclose()
			except Exception as error:
				logger.warning("VirusTotal cache client shutdown failed: %s", error)
	return results


async def scan_attachments(attachments: list[ParsedAttachment]) -> StaticScanResult:
	rule_set = await asyncio.to_thread(_compile_rules)
	findings: list[str] = []
	coverage_findings: list[str] = []
	digests: list[str] = []
	archive_budget = _ArchiveBudget(
		entries_remaining=ZIP_MAX_ENTRIES,
		total_bytes_remaining=ZIP_MAX_TOTAL_BYTES,
		coverage_findings=coverage_findings,
	)
	for attachment in attachments:
		digest = hashlib.sha256(attachment.payload).hexdigest()
		digests.append(digest)
		matches = await asyncio.to_thread(_scan_attachment, rule_set, attachment)
		findings.extend(f"YARA match: {match}" for match in matches)
		archive_kind = await asyncio.to_thread(_archive_kind, attachment.payload, attachment.filename)
		if archive_kind in {"rar", "7z"}:
			coverage_findings.append(f"Archive not fully inspected: {archive_kind.upper()} archive unsupported")
		elif archive_kind == "malformed_zip":
			coverage_findings.append("Archive not fully inspected: ZIP archive is malformed")
		elif archive_kind == "zip":
			if rule_set is None:
				coverage_findings.append("Archive not fully inspected: YARA rules unavailable")
			else:
				findings.extend(
					await asyncio.to_thread(
						_scan_zip_members,
						attachment.payload,
						attachment.filename or "attachment.zip",
						rule_set,
						archive_budget,
					)
				)

	try:
		virus_total = await asyncio.wait_for(
			_virustotal_lookup(digests),
			timeout=VIRUSTOTAL_TIMEOUT_SECONDS,
		)
	except asyncio.TimeoutError:
		logger.warning("VirusTotal lookup exceeded %.2f seconds; continuing with local YARA results", VIRUSTOTAL_TIMEOUT_SECONDS)
		virus_total = {}
	findings.extend(_virustotal_findings(virus_total))
	all_findings = list(dict.fromkeys(findings + coverage_findings))
	status = "suspicious" if findings else "partial" if coverage_findings else "pass"
	return StaticScanResult(
		status=status,
		score=min(len(findings) * 20, 30),
		findings=all_findings,
		virus_total=virus_total,
	)
