from app.engine.parser import ParsedEmail
from app.fingerprint.pii_sanitizer import redact_pii
from app.fingerprint.tlsh_generator import sha256_hex, tlsh_hex
from app.schemas import EmailFingerprint, IOCFingerprint


def build_email_fingerprint(email: ParsedEmail) -> EmailFingerprint:
	redaction = redact_pii(email.subject_and_body)
	iocs = [
		IOCFingerprint(kind="url", value=url, sha256=sha256_hex(url))
		for url in email.urls
	]
	iocs.extend(
		IOCFingerprint(
			kind="attachment",
			value=attachment.filename or attachment.content_type,
			sha256=sha256_hex(attachment.payload),
		)
		for attachment in email.attachments
	)
	return EmailFingerprint(
		redacted_body=redaction.text,
		body_sha256=sha256_hex(redaction.text),
		tlsh=tlsh_hex(redaction.text),
		pii_redactions=redaction.counts,
		iocs=iocs,
	)