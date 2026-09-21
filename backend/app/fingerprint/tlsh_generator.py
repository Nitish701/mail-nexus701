from __future__ import annotations

import hashlib


def sha256_hex(value: bytes | str) -> str:
	data = value.encode("utf-8") if isinstance(value, str) else value
	return hashlib.sha256(data).hexdigest()


def tlsh_hex(value: str) -> str | None:
	data = value.encode("utf-8")
	if len(data) < 50:
		return None

	try:
		import tlsh
		result = tlsh.hash(data)
		return result if result and result != "TNULL" else None
	except (ImportError, AttributeError, ValueError):
		return None
