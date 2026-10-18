from __future__ import annotations

from dataclasses import dataclass
import re

SENSITIVE_MESSAGE_PATTERNS: tuple[tuple[str, re.Pattern[str], str], ...] = (
	(
		"labeled_secret",
		re.compile(
			r"\b(?:password|passcode|secret|access token|api key)\s*"
			r"(?:is|:|=)\s*[^\s,;]+",
			re.IGNORECASE,
		),
		"[REDACTED_SECRET]",
	),
	(
		"labeled_code",
		re.compile(
			r"\b(?:verification|security|one[- ]time|login|authentication|auth|otp)\s+"
			r"(?:code|pin|password)\s*(?:is|:|=|-)?\s*[A-Z0-9-]{4,12}\b",
			re.IGNORECASE,
		),
		"[REDACTED_CODE]",
	),
	("standalone_code", re.compile(r"(?<!\d)\d{6}(?!\d)"), "[REDACTED_CODE]"),
	(
		"secret_url_parameter",
		re.compile(
			r"([?&](?:token|code|otp|key|auth|session|sig|secret|password)=)[^&#\s]+",
			re.IGNORECASE,
		),
		r"\1[REDACTED]",
	),
)


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


def redact_sensitive_message(text: str) -> RedactionResult:
	"""Redact PII and common verification-code/secrets before AI processing."""
	redaction = redact_pii(text)
	redacted = redaction.text
	counts = dict(redaction.counts)
	for name, pattern, replacement in SENSITIVE_MESSAGE_PATTERNS:
		redacted, count = pattern.subn(replacement, redacted)
		if count:
			counts[name] = count
	return RedactionResult(text=redacted, counts=counts)
