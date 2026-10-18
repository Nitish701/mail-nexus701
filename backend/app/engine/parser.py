from __future__ import annotations

from dataclasses import dataclass
from email import policy
from email.parser import BytesParser
from email.utils import getaddresses, parseaddr
import ipaddress
import re
from urllib.parse import urlparse

from app.config import TRUSTED_RECEIVED_HOSTS


URL_PATTERN = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)


@dataclass
class ParsedAttachment:
	filename: str | None
	content_type: str
	size: int
	disposition: str | None
	payload: bytes


@dataclass
class ParsedEmail:
	message_id: str | None
	from_address: str | None
	from_domain: str | None
	return_path: str | None
	source_ip: str | None
	private_relay_ips: list[str]
	to_addresses: list[str]
	cc_addresses: list[str]
	bcc_addresses: list[str]
	subject: str | None
	headers: dict[str, list[str]]
	urls: list[str]
	html_links: list[tuple[str, str]]
	attachments: list[ParsedAttachment]
	subject_and_body: str


def _payload_text(part) -> str:
	payload = part.get_payload(decode=True)
	if payload is None:
		raw_payload = part.get_payload()
		return raw_payload if isinstance(raw_payload, str) else ""

	charset = part.get_content_charset() or "utf-8"
	return payload.decode(charset, errors="replace")


def _clean_url(value: str) -> str:
	return value.rstrip(".,;:!?)]}")


def _extract_urls(text: str) -> list[str]:
	urls: list[str] = []
	for match in URL_PATTERN.finditer(text):
		url = _clean_url(match.group(0))
		parsed = urlparse(url)
		if parsed.scheme and parsed.netloc and url not in urls:
			urls.append(url)
	return urls


def _extract_source_ips(headers: dict[str, list[str]]) -> tuple[str | None, list[str]]:
	private_ips: list[str] = []

    # 1. Validate the topmost Received header against trusted mail servers.
    received_headers = headers.get("received", [])
    if not received_headers or not TRUSTED_RECEIVED_HOSTS:
        return None, private_ips

    # The receiving MTA prepends its Received field. Do not trust older,
    # sender-supplied headers if the topmost hop is not a trust anchor.
    received = received_headers[0]
    by_match = re.search(r"\bby\s+([A-Za-z0-9.-]+)", received, re.IGNORECASE)

    if not by_match or by_match.group(1).lower().rstrip(".") not in TRUSTED_RECEIVED_HOSTS:
        return None, private_ips

    # 2. Extract the connecting IP from the trusted topmost Received header.
    from_match = re.search(r"\bfrom\b(.*?)\bby\b", received, re.IGNORECASE)
    if not from_match:
        return None, private_ips

    candidates = re.findall(
        r"\[((?:IPv6:)?[0-9a-fA-F:.]+)\]",
        from_match.group(1),
        re.IGNORECASE,
    )

    for candidate in candidates:
        candidate = re.sub(r"^IPv6:", "", candidate, flags=re.IGNORECASE)
        try:
            address = ipaddress.ip_address(candidate)
        except ValueError:
            continue

        if address.is_global:
            return str(address), private_ips

        if address.is_private and str(address) not in private_ips:
            private_ips.append(str(address))

    # 3. Fall back to proxy headers only if the trusted Received header
    # did not yield a usable public IP.
    proxy_headers = (
        "cf-connecting-ip",
        "true-client-ip",
        "x-real-ip",
        "x-client-ip",
        "x-forwarded-for",
        "x-originating-ip",
        "x-sender-ip",
    )

    for header_name in proxy_headers:
        for value in headers.get(header_name, []):
            for candidate in value.split(","):
                candidate = candidate.strip().strip("[]")
                candidate = re.sub(r"^IPv6:", "", candidate, flags=re.IGNORECASE)

                try:
                    address = ipaddress.ip_address(candidate)
                except ValueError:
                    continue

                if address.is_global:
                    return str(address), private_ips

                if address.is_private and str(address) not in private_ips:
                    private_ips.append(str(address))

    return None, private_ips

	return None, private_ips


def parse_mime(raw_message: bytes) -> ParsedEmail:
	message = BytesParser(policy=policy.default).parsebytes(raw_message)
	headers: dict[str, list[str]] = {}
	for key, value in message.items():
		headers.setdefault(key.lower(), []).append(str(value))

	from_address = parseaddr(message.get("From", ""))[1] or None
	from_domain = from_address.rsplit("@", 1)[1].lower() if from_address and "@" in from_address else None
	return_path = parseaddr(message.get("Return-Path", ""))[1] or None
	to_addresses = [address for _, address in getaddresses(message.get_all("To", [])) if address]

	# Extract CC and BCC with deduplication preserving order
	cc_raw = [address for _, address in getaddresses(message.get_all("Cc", [])) if address]
	cc_addresses: list[str] = []
	for addr in cc_raw:
		if addr not in cc_addresses:
			cc_addresses.append(addr)

	bcc_raw = [address for _, address in getaddresses(message.get_all("Bcc", [])) if address]
	bcc_addresses: list[str] = []
	for addr in bcc_raw:
		if addr not in bcc_addresses:
			bcc_addresses.append(addr)

	text_parts: list[str] = []
	urls: list[str] = []
	html_links: list[tuple[str, str]] = []
	attachments: list[ParsedAttachment] = []
	for part in message.walk():
		if part.is_multipart():
			continue

		disposition = part.get_content_disposition()
		filename = part.get_filename()
		payload = part.get_payload(decode=True) or b""
		if disposition == "attachment" or filename:
			attachments.append(
				ParsedAttachment(
					filename=filename,
					content_type=part.get_content_type(),
					size=len(payload),
					disposition=disposition,
					payload=payload,
				)
			)
			continue

		if part.get_content_type() in {"text/plain", "text/html"}:
			text = _payload_text(part)
			text_parts.append(text)
			urls.extend(url for url in _extract_urls(text) if url not in urls)

			if part.get_content_type() == "text/html":
				for match in re.finditer(r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', text, re.IGNORECASE | re.DOTALL):
					href = match.group(1)
					text_content = match.group(2)
					if href.startswith(("http://", "https://")):
						html_links.append((text_content, href))

	subject = str(message.get("Subject", "")) or None
	subject_and_body = "\n".join(value for value in [subject or "", *text_parts] if value)
	source_ip, private_relay_ips = _extract_source_ips(headers)
	return ParsedEmail(
		message_id=message.get("Message-ID"),
		from_address=from_address,
		from_domain=from_domain,
		return_path=return_path,
		source_ip=source_ip,
		private_relay_ips=private_relay_ips,
		to_addresses=to_addresses,
		cc_addresses=cc_addresses,
		bcc_addresses=bcc_addresses,
		subject=subject,
		headers=headers,
		urls=urls,
		html_links=html_links,
		attachments=attachments,
		subject_and_body=subject_and_body,
	)
