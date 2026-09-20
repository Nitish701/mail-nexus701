from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class RedactionResult:
	text: str
	counts: dict[str, int]


PII_PATTERNS: tuple[tuple[str, re.Pattern[str], str], ...] = (
	("email", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE), "[REDACTED_EMAIL]"),
	("ipv4", re.compile(r"(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])"), "[REDACTED_IP]"),
	("phone", re.compile(r"(?<!\w)(?:\+?\d[\d(). -]{7,}\d)(?!\w)"), "[REDACTED_PHONE]"),
	("ssn", re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)"), "[REDACTED_SSN]"),
	("credit_card", re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)"), "[REDACTED_CARD]"),
)


def redact_pii(text: str) -> RedactionResult:
	redacted = text
	counts: dict[str, int] = {}
	for name, pattern, replacement in PII_PATTERNS:
		redacted, count = pattern.subn(replacement, redacted)
		if count:
			counts[name] = count
	return RedactionResult(text=redacted, counts=counts)
