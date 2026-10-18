from __future__ import annotations

import re

from app.config import TRUSTED_AUTHSERV_IDS
from app.engine.parser import ParsedEmail


VERDICT_PATTERN = re.compile(r"(?:spf|dkim)=(pass|fail|softfail|neutral|none|temperror|permerror)", re.IGNORECASE)


def _trusted_authentication_results(
	email: ParsedEmail,
	trusted_authserv_ids: frozenset[str],
) -> list[str]:
	trusted_results = []
	for value in email.headers.get("authentication-results", []):
		authserv_id = value.split(";", 1)[0].strip().lower()
		if authserv_id in trusted_authserv_ids:
			trusted_results.append(value)
	return trusted_results


def has_trusted_authentication(
	email: ParsedEmail,
	trusted_authserv_ids: frozenset[str] = TRUSTED_AUTHSERV_IDS,
) -> bool:
	"""Return true only for SPF and DKIM passes from a configured authserv-id."""
	trusted_results = _trusted_authentication_results(email, trusted_authserv_ids)
	for mechanism in ("spf", "dkim"):
		verdicts = [
			verdict.lower()
			for result in trusted_results
			for verdict in re.findall(rf"\b{mechanism}=([a-z]+)", result, re.IGNORECASE)
		]
		if not verdicts or any(verdict != "pass" for verdict in verdicts):
			return False
	return bool(trusted_results)


def _header_verdict(email: ParsedEmail, mechanism: str) -> str | None:
	trusted_results = _trusted_authentication_results(email, TRUSTED_AUTHSERV_IDS)
	if trusted_results:
		for value in trusted_results:
			match = re.search(rf"\b{mechanism}=([a-z]+)", value, re.IGNORECASE)
			if match:
				return match.group(1).lower()

	for header_name in ("authentication-results", "received-spf"):
		for value in email.headers.get(header_name, []):
			match = re.search(rf"\b{mechanism}=([a-z]+)", value, re.IGNORECASE)
			if match:
				return match.group(1).lower()
	return None


def _check(verdict: str | None, mechanism: str) -> dict[str, str | int]:
	if verdict == "pass":
		return {"status": "pass", "reason": f"{mechanism.upper()} passed upstream validation", "score": 0}
	if verdict == "fail":
		return {"status": verdict, "reason": f"{mechanism.upper()} reported {verdict}", "score": 15}
	if verdict == "softfail":
		return {"status": verdict, "reason": f"{mechanism.upper()} reported {verdict}", "score": 10}
	if verdict == "permerror":
		return {"status": verdict, "reason": f"{mechanism.upper()} reported {verdict}", "score": 5}
	if verdict:
		return {"status": verdict, "reason": f"{mechanism.upper()} reported {verdict}", "score": 0}
	return {"status": "unknown", "reason": f"No {mechanism.upper()} validation result was supplied", "score": 0}


def validate_authentication(email: ParsedEmail) -> dict[str, dict[str, str | int]]:
	spf_verdict = _header_verdict(email, "spf")
	dkim_verdict = _header_verdict(email, "dkim")
	from_domain = email.from_domain
	return_domain = email.return_path.rsplit("@", 1)[1].lower() if email.return_path and "@" in email.return_path else None

	checks = {
		"spf": _check(spf_verdict, "spf"),
		"dkim": _check(dkim_verdict, "dkim"),
	}
	if from_domain and return_domain and from_domain != return_domain:
		checks["alignment"] = {
			"status": "mismatch",
			"reason": "From and Return-Path domains do not align",
			"score": 5,
		}
	elif not from_domain or not return_domain:
		checks["alignment"] = {
			"status": "unknown",
			"reason": "From or Return-Path domain is unavailable",
			"score": 0,
		}
	else:
		checks["alignment"] = {
			"status": "pass",
			"reason": "From and Return-Path domains align",
			"score": 0,
		}
	return checks
