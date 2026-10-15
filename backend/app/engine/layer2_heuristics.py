from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlparse

from app.engine.parser import ParsedEmail


SUSPICIOUS_TERMS = (
	(re.compile(r"\b(urgent|immediately|act now| final notice)\b", re.IGNORECASE), "urgent language", 8),
	(re.compile(r"\b(verify|confirm|unlock|reset)\b.{0,40}\b(password|account|login|credentials)\b", re.IGNORECASE), "credential request", 12),
	(re.compile(r"\b(gift card|wire transfer|bitcoin|crypto payment)\b", re.IGNORECASE), "financial request", 10),
)
DANGEROUS_EXTENSIONS = {
	".exe", ".scr", ".js", ".jse", ".vbs", ".vbe", ".wsf", ".bat", ".cmd",
	".ps1", ".hta", ".lnk", ".iso", ".com", ".pif", ".jar", ".chm",
}
MACRO_EXTENSIONS = {".docm", ".xlsm", ".pptm"}
DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png"}

URGENCY_ACTION_PATTERN = re.compile(
	r"\b(?:urgent(?:ly)?|immediately|act now|final notice|action required|expires? today|within\s+\d+\s+hours?)\b"
	r"[^\n.!?;]{0,100}\b(?:click|open|download|review|verify|confirm|update|restore|unlock|reset|sign in|log in|pay|settle)\b"
	r"|\b(?:click|open|download|review|verify|confirm|update|restore|unlock|reset|sign in|log in|pay|settle)\b"
	r"[^\n.!?;]{0,100}\b(?:urgent(?:ly)?|immediately|act now|final notice|action required|expires? today|within\s+\d+\s+hours?)\b",
	re.IGNORECASE,
)
CREDENTIAL_ACTION_PATTERN = re.compile(
	r"\b(?:account|password|login|credentials|mailbox)\b[^\n.!?;]{0,60}"
	r"\b(?:verify|confirm|update|restore|unlock|reset|sign in|log in)\b"
	r"|\b(?:verify|confirm|update|restore|unlock|reset|sign in|log in)\b[^\n.!?;]{0,60}"
	r"\b(?:account|password|login|credentials|mailbox)\b",
	re.IGNORECASE,
)
PAYMENT_DUE_ACTION_PATTERN = re.compile(
	r"\b(?:invoice|payment|bill)\b[^\n.!?;]{0,60}\b(?:due|overdue|past due)\b[^\n.!?;]{0,60}"
	r"\b(?:pay|settle|review|open|download)\b"
	r"|\b(?:pay|settle|review|open|download)\b[^\n.!?;]{0,60}"
	r"\b(?:invoice|payment|bill)\b[^\n.!?;]{0,60}\b(?:due|overdue|past due)\b",
	re.IGNORECASE,
)
CREDENTIAL_URL_PATTERN = re.compile(
	r"\b(?:login|log-in|signin|sign-in|verify|account|password|credential|auth|session)\b",
	re.IGNORECASE,
)


def scan_heuristics(email: ParsedEmail) -> tuple[list[str], int]:
	findings: list[str] = []
	score = 0
	combined_text = email.subject_and_body
	for pattern, label, points in SUSPICIOUS_TERMS:
		if pattern.search(combined_text):
			findings.append(label)
			score += points

	# Combination signals add 5-8 points each; existing keyword weights and the 40-point cap remain unchanged.
	for pattern, label, points in (
		(URGENCY_ACTION_PATTERN, "urgent action request", 6),
		(CREDENTIAL_ACTION_PATTERN, "credential action request", 8),
		(PAYMENT_DUE_ACTION_PATTERN, "payment due action request", 5),
	):
		if pattern.search(combined_text):
			findings.append(label)
			score += points

	has_credential_language = bool(CREDENTIAL_URL_PATTERN.search(combined_text))
	for url in dict.fromkeys(email.urls):
		try:
			parsed = urlparse(url)
			hostname = (parsed.hostname or "").lower()
		except ValueError:
			findings.append("malformed URL")
			score += 4
			continue

		is_non_https = parsed.scheme.lower() != "https"
		if is_non_https:
			findings.append("non-HTTPS URL")
			score += 4

		try:
			ipaddress.ip_address(hostname)
			is_ip_address = True
		except ValueError:
			is_ip_address = False
		if is_ip_address:
			findings.append("IP-address URL")
			score += 10
		if "@" in parsed.netloc:
			findings.append("URL contains user-info")
			score += 10
		url_has_credential_context = bool(CREDENTIAL_URL_PATTERN.search(url))
		if is_non_https and (has_credential_language or url_has_credential_context):
			findings.append("non-HTTPS credential URL")
			score += 6
		if any(label.startswith("xn--") for label in hostname.split(".")):
			if has_credential_language or url_has_credential_context:
				findings.append("punycode URL with credential context")
				score += 6

	for attachment in email.attachments:
		filename = (attachment.filename or "").strip().lower()
		basename = re.split(r"[\\/]", filename)[-1]
		extension = f".{basename.rsplit('.', 1)[-1]}" if "." in basename else ""
		if extension in DANGEROUS_EXTENSIONS:
			findings.append(f"dangerous attachment: {attachment.filename}")
			score += 15
			parts = basename.rsplit(".", 2)
			if len(parts) == 3 and f".{parts[-2]}" in DOCUMENT_EXTENSIONS:
				findings.append(f"double-extension attachment: {attachment.filename}")
				score += 5
		elif extension in MACRO_EXTENSIONS:
			findings.append(f"macro-enabled attachment: {attachment.filename}")
			score += 8

	unique_findings = list(dict.fromkeys(findings))
	return unique_findings, min(score, 40)
