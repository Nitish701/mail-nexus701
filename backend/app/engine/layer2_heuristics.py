from __future__ import annotations

from urllib.parse import urlparse
import re

from app.engine.parser import ParsedEmail


SUSPICIOUS_TERMS = (
	(re.compile(r"\b(urgent|immediately|act now| final notice)\b", re.IGNORECASE), "urgent language", 8),
	(re.compile(r"\b(verify|confirm|unlock|reset)\b.{0,40}\b(password|account|login|credentials)\b", re.IGNORECASE), "credential request", 12),
	(re.compile(r"\b(gift card|wire transfer|bitcoin|crypto payment)\b", re.IGNORECASE), "financial request", 10),
)
DANGEROUS_EXTENSIONS = {".exe", ".scr", ".js", ".vbs", ".bat", ".cmd", ".ps1", ".hta", ".iso"}


def scan_heuristics(email: ParsedEmail) -> tuple[list[str], int]:
	findings: list[str] = []
	score = 0
	for pattern, label, points in SUSPICIOUS_TERMS:
		if pattern.search(email.subject_and_body):
			findings.append(label)
			score += points

	for url in email.urls:
		parsed = urlparse(url)
		hostname = (parsed.hostname or "").lower()
		if parsed.scheme != "https":
			findings.append("non-HTTPS URL")
			score += 4
		if re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}", hostname):
			findings.append("IP-address URL")
			score += 10
		if "@" in parsed.netloc:
			findings.append("URL contains user-info")
			score += 10

	for attachment in email.attachments:
		filename = (attachment.filename or "").lower()
		if any(filename.endswith(extension) for extension in DANGEROUS_EXTENSIONS):
			findings.append(f"dangerous attachment: {attachment.filename}")
			score += 15

	unique_findings = list(dict.fromkeys(findings))
	return unique_findings, min(score, 40)
