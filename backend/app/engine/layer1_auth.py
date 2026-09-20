from __future__ import annotations

import re

from app.engine.parser import ParsedEmail


VERDICT_PATTERN = re.compile(r"(?:spf|dkim)=(pass|fail|softfail|neutral|none|temperror|permerror)", re.IGNORECASE)


def _header_verdict(email: ParsedEmail, mechanism: str) -> str | None:
	for header_name in ("authentication-results", "received-spf"):
		for value in email.headers.get(header_name, []):
			match = re.search(rf"\b{mechanism}=([a-z]+)", value, re.IGNORECASE)
			if match:
				return match.group(1).lower()
	return None


def _check(verdict: str | None, mechanism: str, present: bool) -> dict[str, str | int]:
	if verdict == "pass":
		return {"status": "pass", "reason": f"{mechanism.upper()} passed upstream validation", "score": 0}
	if verdict in {"fail", "softfail", "permerror"}:
		return {"status": verdict, "reason": f"{mechanism.upper()} reported {verdict}", "score": 15}
	if verdict:
		return {"status": verdict, "reason": f"{mechanism.upper()} reported {verdict}", "score": 5}
	if present:
		return {"status": "unknown", "reason": f"{mechanism.upper()} signature or header found without a verdict", "score": 5}
	return {"status": "unknown", "reason": f"No {mechanism.upper()} validation result was supplied", "score": 5}


def validate_authentication(email: ParsedEmail) -> dict[str, dict[str, str | int]]:
	spf_verdict = _header_verdict(email, "spf")
	dkim_verdict = _header_verdict(email, "dkim")
	from_domain = email.from_domain
	return_domain = email.return_path.rsplit("@", 1)[1].lower() if email.return_path and "@" in email.return_path else None

	checks = {
		"spf": _check(spf_verdict, "spf", bool(from_domain)),
		"dkim": _check(dkim_verdict, "dkim", "dkim-signature" in email.headers),
	}
	if from_domain and return_domain and from_domain != return_domain:
		checks["alignment"] = {
			"status": "mismatch",
			"reason": "From and Return-Path domains do not align",
			"score": 5,
		}
	else:
		checks["alignment"] = {
			"status": "pass",
			"reason": "From and Return-Path domains align or are unavailable",
			"score": 0,
		}
	return checks
