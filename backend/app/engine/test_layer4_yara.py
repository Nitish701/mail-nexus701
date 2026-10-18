import asyncio
import hashlib
from io import BytesIO
import json
import stat
import struct
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
import zipfile

import httpx

from app.engine import layer4_yara
from app.engine.parser import ParsedAttachment


class _ArchiveMatch:
	def __init__(self, rule: str) -> None:
		self.rule = rule


class _ArchiveRuleSet:
	def match(self, data: bytes) -> list[_ArchiveMatch]:
		return [_ArchiveMatch("archive_test_rule")] if b"YARA_HIT" in data else []


def _zip_bytes(members: dict[str, bytes]) -> bytes:
	buffer = BytesIO()
	with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
		for name, payload in members.items():
			archive.writestr(name, payload)
	return buffer.getvalue()


class _FakeZipMember:
	def __init__(self) -> None:
		self.filename = "oversized.bin"
		self.file_size = 5
		self.compress_size = 100
		self.flag_bits = 0
		self.external_attr = 0

	def is_dir(self) -> bool:
		return False


class _FakeZipMemberStream:
	def __init__(self) -> None:
		self.bytes_read = 0

	def __enter__(self):
		return self

	def __exit__(self, *_args):
		return None

	def read(self, size: int) -> bytes:
		read_size = min(size, 100 - self.bytes_read)
		self.bytes_read += read_size
		return b"x" * read_size


class TestVirusTotalLookup(unittest.IsolatedAsyncioTestCase):
	def setUp(self) -> None:
		layer4_yara._local_virus_total_cache.clear()
		self.attachment = ParsedAttachment(
			filename="sample.bin",
			content_type="application/octet-stream",
			size=6,
			disposition="attachment",
			payload=b"sample",
		)

	def _mock_http_client(self, response=None, error=None):
		http_client = AsyncMock()
		if error:
			http_client.get.side_effect = error
		else:
			http_client.get.return_value = response
		async_context = MagicMock()
		async_context.__aenter__ = AsyncMock(return_value=http_client)
		async_context.__aexit__ = AsyncMock(return_value=None)
		return http_client, async_context

	@patch("app.engine.layer4_yara._redis_client", new_callable=AsyncMock, return_value=None)
	@patch("app.engine.layer4_yara.VIRUSTOTAL_API_KEY", "test-key")
	async def test_successful_lookup_is_returned_and_interpreted(self, _redis_client):
		payload = json.dumps({
			"data": {
				"attributes": {
					"last_analysis_stats": {"malicious": 2, "suspicious": 1},
				},
			},
		})
		response = MagicMock(is_success=True, text=payload)
		http_client, async_context = self._mock_http_client(response=response)
		digest = hashlib.sha256(self.attachment.payload).hexdigest()

		with patch("app.engine.layer4_yara.httpx.AsyncClient", return_value=async_context) as client_factory:
			result = await layer4_yara._virustotal_lookup([digest])

		self.assertEqual(result, {digest: payload})
		self.assertEqual(
			layer4_yara._virustotal_findings(result),
			["VirusTotal detections: 2 malicious, 1 suspicious"],
		)
		client_factory.assert_called_once_with(timeout=layer4_yara.VIRUSTOTAL_TIMEOUT_SECONDS)
		http_client.get.assert_awaited_once()

	@patch("app.engine.layer4_yara.VIRUSTOTAL_TIMEOUT_SECONDS", 0.01)
	@patch("app.engine.layer4_yara._scan_attachment", return_value=["local_test_rule"])
	@patch("app.engine.layer4_yara._compile_rules", return_value=object())
	@patch("app.engine.layer4_yara._virustotal_lookup", new_callable=AsyncMock)
	async def test_timeout_keeps_local_yara_finding(self, _lookup, _compile, _scan):
		async def slow_lookup(_digests):
			await asyncio.sleep(0.1)

		_lookup.side_effect = slow_lookup

		result = await layer4_yara.scan_attachments([self.attachment])

		self.assertEqual(result.virus_total, {})
		self.assertEqual(result.findings, ["YARA match: local_test_rule"])
		self.assertEqual(result.score, 20)
		self.assertEqual(result.status, "suspicious")

	@patch("app.engine.layer4_yara._redis_client", new_callable=AsyncMock, return_value=None)
	@patch("app.engine.layer4_yara.VIRUSTOTAL_API_KEY", "test-key")
	async def test_service_errors_fall_back_without_vt_findings(self, _redis_client):
		digest = hashlib.sha256(self.attachment.payload).hexdigest()
		for payload, error in (
			(None, httpx.ConnectError("service unavailable")),
			(MagicMock(is_success=False, status_code=503), None),
		):
			with self.subTest(error=error, response=payload):
				layer4_yara._local_virus_total_cache.clear()
				http_client, async_context = self._mock_http_client(response=payload, error=error)
				with patch("app.engine.layer4_yara.httpx.AsyncClient", return_value=async_context):
					result = await layer4_yara._virustotal_lookup([digest])
				self.assertEqual(result, {})
				http_client.get.assert_awaited_once()

	@patch("app.engine.layer4_yara._redis_client", new_callable=AsyncMock)
	@patch("app.engine.layer4_yara.VIRUSTOTAL_API_KEY", "test-key")
	async def test_cache_errors_fall_back_to_api(self, redis_client):
		redis_client.return_value.get.side_effect = RuntimeError("Redis unavailable")
		payload = json.dumps({"data": {"attributes": {"last_analysis_stats": {"malicious": 0}}}})
		response = MagicMock(is_success=True, text=payload)
		http_client, async_context = self._mock_http_client(response=response)
		digest = hashlib.sha256(self.attachment.payload).hexdigest()

		with patch("app.engine.layer4_yara.httpx.AsyncClient", return_value=async_context):
			result = await layer4_yara._virustotal_lookup([digest])

		self.assertEqual(result, {digest: payload})
		http_client.get.assert_awaited_once()
		redis_client.return_value.aclose.assert_awaited_once()


class TestZipMemberScanning(unittest.IsolatedAsyncioTestCase):
	def setUp(self) -> None:
		self.rule_set = _ArchiveRuleSet()

	def _attachment(self, payload: bytes, filename: str = "archive.zip") -> ParsedAttachment:
		return ParsedAttachment(filename, "application/zip", len(payload), "attachment", payload)

	async def _scan(self, attachment: ParsedAttachment):
		with (
			patch("app.engine.layer4_yara._compile_rules", return_value=self.rule_set),
			patch("app.engine.layer4_yara._virustotal_lookup", new_callable=AsyncMock, return_value={}) as lookup,
		):
			result = await layer4_yara.scan_attachments([attachment])
		return result, lookup

	async def test_normal_zip_is_scanned_without_extraction(self):
		archive = _zip_bytes({"readme.txt": b"ordinary document"})
		result, _ = await self._scan(self._attachment(archive))

		self.assertEqual(result.status, "pass")
		self.assertEqual(result.findings, [])

	async def test_yara_matching_member_is_reported(self):
		archive = _zip_bytes({"invoice.txt": b"YARA_HIT"})
		result, _ = await self._scan(self._attachment(archive))

		self.assertEqual(result.status, "suspicious")
		self.assertIn(
			"YARA match: archive.zip!/invoice.txt: archive_test_rule",
			result.findings,
		)

	async def test_nested_zip_members_are_scanned_with_shared_budget(self):
		nested = _zip_bytes({"payload.bin": b"YARA_HIT"})
		outer = _zip_bytes({"inner.zip": nested})
		result, _ = await self._scan(self._attachment(outer))

		self.assertIn(
			"YARA match: archive.zip!/inner.zip!/payload.bin: archive_test_rule",
			result.findings,
		)
		self.assertEqual(result.status, "suspicious")

	async def test_nested_depth_limit_reports_partial_coverage(self):
		nested = _zip_bytes({"payload.bin": b"YARA_HIT"})
		outer = _zip_bytes({"inner.zip": nested})
		with patch("app.engine.layer4_yara.ZIP_MAX_NESTED_DEPTH", 0):
			result, _ = await self._scan(self._attachment(outer))

		self.assertEqual(result.status, "partial")
		self.assertTrue(any("nested archive depth limit" in finding for finding in result.findings))
		self.assertEqual(result.score, 0)

	async def test_nested_archives_share_total_decompressed_byte_budget(self):
		nested = _zip_bytes({"payload.bin": b"0123456789"})
		outer = _zip_bytes({"inner.zip": nested})
		with patch("app.engine.layer4_yara.ZIP_MAX_TOTAL_BYTES", len(nested) + 10):
			result, _ = await self._scan(self._attachment(outer))

		self.assertEqual(result.status, "partial")
		self.assertTrue(any("decompressed byte limit reached while reading inner.zip!/payload.bin" in finding for finding in result.findings))

	async def test_encrypted_and_corrupt_archives_report_partial_coverage(self):
		encrypted = bytearray(_zip_bytes({"private.txt": b"secret"}))
		local_header = encrypted.find(b"PK\x03\x04")
		central_header = encrypted.find(b"PK\x01\x02")
		struct.pack_into("<H", encrypted, local_header + 6, 1)
		struct.pack_into("<H", encrypted, central_header + 8, 1)
		for payload in (bytes(encrypted), b"PK\x03\x04broken"):
			with self.subTest(payload=payload[:8]):
				result, _ = await self._scan(self._attachment(payload))
				self.assertEqual(result.status, "partial")
				self.assertTrue(any("Archive not fully inspected:" in finding for finding in result.findings))

	async def test_suspicious_paths_and_symlinks_are_skipped(self):
		buffer = BytesIO()
		with zipfile.ZipFile(buffer, "w") as archive:
			archive.writestr("../escape.bin", b"YARA_HIT")
			symlink = zipfile.ZipInfo("link")
			symlink.create_system = 3
			symlink.external_attr = (stat.S_IFLNK | 0o777) << 16
			archive.writestr(symlink, b"target")
		result, _ = await self._scan(self._attachment(buffer.getvalue()))

		self.assertEqual(result.status, "suspicious")
		self.assertFalse(any("!/../escape.bin:" in finding or "!/link:" in finding for finding in result.findings))
		self.assertTrue(any("suspicious ZIP member path or symlink" in finding for finding in result.findings))

	async def test_entry_member_total_and_ratio_limits_report_partial(self):
		cases = (
			(
				"entry count",
				_zip_bytes({"one.txt": b"1", "two.txt": b"2"}),
				{"ZIP_MAX_ENTRIES": 1},
			),
			(
				"member size",
				_zip_bytes({"large.txt": b"123456"}),
				{"ZIP_MAX_MEMBER_BYTES": 5},
			),
			(
				"total expanded size",
				_zip_bytes({"one.txt": b"123", "two.txt": b"456"}),
				{"ZIP_MAX_TOTAL_BYTES": 4},
			),
			(
				"compression ratio",
				_zip_bytes({"compressed.txt": b"A" * 4096}),
				{"ZIP_MAX_COMPRESSION_RATIO": 1.0},
			),
		)
		for name, payload, limits in cases:
			with self.subTest(limit=name):
				with patch.multiple("app.engine.layer4_yara", **limits):
					result, _ = await self._scan(self._attachment(payload))
				self.assertEqual(result.status, "partial")
				self.assertTrue(any("Archive not fully inspected:" in finding for finding in result.findings))

	async def test_member_size_limit_caps_actual_decompressed_bytes_read(self):
		member = _FakeZipMember()
		stream = _FakeZipMemberStream()

		class FakeArchive:
			def __enter__(self):
				return self

			def __exit__(self, *_args):
				return None

			def infolist(self):
				return [member]

			def open(self, _info):
				return stream

		budget = layer4_yara._ArchiveBudget(10, 100, [])
		with (
			patch("app.engine.layer4_yara.zipfile.ZipFile", return_value=FakeArchive()),
			patch("app.engine.layer4_yara.ZIP_MAX_MEMBER_BYTES", 10),
			patch("app.engine.layer4_yara.ZIP_MAX_TOTAL_BYTES", 100),
			patch("app.engine.layer4_yara.ZIP_MAX_COMPRESSION_RATIO", 100.0),
		):
			layer4_yara._scan_zip_members(b"synthetic", "archive.zip", self.rule_set, budget)

		self.assertEqual(stream.bytes_read, 10)
		self.assertEqual(budget.total_bytes_remaining, 90)
		self.assertTrue(any("decompressed byte limit" in finding for finding in budget.coverage_findings))

	async def test_rar_and_7z_are_not_reported_clean(self):
		archives = (
			(self._attachment(b"Rar!\x1a\x07\x00not-scanned", "archive.rar"), "RAR"),
			(self._attachment(b"7z\xbc\xaf\x27\x1cnot-scanned", "archive.7z"), "7Z"),
		)
		for attachment, archive_type in archives:
			with self.subTest(archive_type=archive_type):
				result, _ = await self._scan(attachment)
				self.assertEqual(result.status, "partial")
				self.assertTrue(any(f"{archive_type} archive unsupported" in finding for finding in result.findings))

	async def test_virus_total_receives_original_archive_digest(self):
		archive = _zip_bytes({"payload.bin": b"YARA_HIT"})
		attachment = self._attachment(archive)
		_, lookup = await self._scan(attachment)

		lookup.assert_awaited_once_with([hashlib.sha256(archive).hexdigest()])


if __name__ == "__main__":
	unittest.main()
