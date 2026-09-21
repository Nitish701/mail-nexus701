from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from html import escape
from typing import Any


# ============================================================
# SEVERITY
# ============================================================

def severity_for_score(score: int | float | None) -> str:
	"""Map a 0-70 base risk score to a human severity band."""

	try:
		value = float(score or 0)
	except (TypeError, ValueError):
		value = 0.0
	if value >= 50:
		return "high"
	if value >= 25:
		return "medium"
	return "low"


# ============================================================
# HELPERS
# ============================================================

def _utc_now() -> str:
	return datetime.now(timezone.utc).isoformat()


def _as_list(value: Any) -> list[Any]:
	if value is None:
		return []
	if isinstance(value, list):
		return value
	return [value]


def _flatten_findings(*groups: Any) -> list[str]:
	findings: list[str] = []
	for group in groups:
		for item in _as_list(group):
			if item is None:
				continue
			text = str(item).strip()
			if text and text not in findings:
				findings.append(text)
	return findings


# ============================================================
# BUILD REPORT (from an InboundEmailResponse payload)
# ============================================================

def build_email_report(payload: dict[str, Any], report_id: str) -> dict[str, Any]:
	"""Turn a scanned-email response payload into a structured report."""

	advisory = payload.get("threat_advisory") or {}
	layers = payload.get("layers") or {}
	static = layers.get("layer4_static") or {}
	ml = layers.get("layer3_ml") or {}

	base_score = int(payload.get("base_score") or 0)
	severity = severity_for_score(base_score)

	findings = _flatten_findings(
		payload.get("heuristic_findings"),
		static.get("findings"),
	)
	for name, check in (payload.get("authentication") or {}).items():
		reason = check.get("reason") if isinstance(check, dict) else None
		if reason:
			findings.append(f"{name.upper()}: {reason}")

	fingerprint = payload.get("fingerprint") or {}
	iocs = fingerprint.get("iocs") or []

	return {
		"report_id": report_id,
		"report_type": "email",
		"generated_at": _utc_now(),
		"title": f"Email Threat Report - {payload.get('subject') or 'No subject'}",
		"severity": severity,
		"risk": {
			"base_score": base_score,
			"max_score": 70,
			"severity": severity,
			"status": advisory.get("status") or severity,
		},
		"message": {
			"message_id": payload.get("message_id"),
			"from": payload.get("from_address"),
			"to": payload.get("to_addresses") or [],
			"subject": payload.get("subject"),
		},
		"geolocation": payload.get("geolocation") or {},
		"authentication": payload.get("authentication") or {},
		"layers": layers,
		"ml": {
			"status": ml.get("status"),
			"score": ml.get("score"),
			"probability": ml.get("probability"),
			"reason": ml.get("reason"),
		},
		"static": {
			"status": static.get("status"),
			"score": static.get("score"),
			"findings": static.get("findings") or [],
		},
		"findings": findings,
		"urls": payload.get("urls") or [],
		"attachments": payload.get("attachments") or [],
		"virustotal": payload.get("virustotal") or {},
		"fingerprint": {
			"body_sha256": fingerprint.get("body_sha256"),
			"tlsh": fingerprint.get("tlsh"),
			"pii_redactions": fingerprint.get("pii_redactions") or {},
			"ioc_count": len(iocs),
		},
		"iocs": iocs,
		"advisory": {
			"status": advisory.get("status"),
			"summary": advisory.get("summary"),
			"recommended_actions": advisory.get("recommended_actions") or [],
		},
	}


# ============================================================
# BUILD CAMPAIGN REPORT
# ============================================================

def build_campaign_report(campaign: dict[str, Any], report_id: str) -> dict[str, Any]:
	"""Turn a correlated campaign payload into a structured report."""

	members = campaign.get("members") or []
	tenants = sorted({str(member.get("tenant_id")) for member in members if member.get("tenant_id")})
	similarities = [float(member.get("similarity")) for member in members if member.get("similarity") is not None]
	average_similarity = round(sum(similarities) / len(similarities), 4) if similarities else None

	tenant_count = int(campaign.get("tenant_count") or len(tenants))
	email_count = int(campaign.get("email_count") or len(members))

	# Cross-tenant campaigns are high severity; single-tenant are medium.
	severity = "high" if tenant_count >= 2 else "medium"

	summary = campaign.get("summary")
	if not summary:
		summary = (
			f"Cross-tenant campaign spanning {tenant_count} tenant(s) and "
			f"{email_count} email(s). Average fingerprint similarity "
			f"{average_similarity if average_similarity is not None else 'n/a'}."
		)

	return {
		"report_id": report_id,
		"report_type": "campaign",
		"generated_at": _utc_now(),
		"title": f"Campaign Report - {campaign.get('campaign_id')}",
		"severity": severity,
		"campaign": {
			"campaign_id": campaign.get("campaign_id"),
			"status": campaign.get("status"),
			"created_at": campaign.get("created_at"),
			"first_seen": campaign.get("first_seen"),
			"last_seen": campaign.get("last_seen"),
			"tenant_count": tenant_count,
			"email_count": email_count,
			"average_similarity": average_similarity,
			"summary": summary,
		},
		"tenants": tenants,
		"members": members,
	}


# ============================================================
# JSON
# ============================================================

def render_json(report: dict[str, Any]) -> str:
	return json.dumps(report, indent=2, default=str)


# ============================================================
# CSV
# ============================================================

def render_csv(report: dict[str, Any]) -> str:
	"""Flatten any report into a section,field,value CSV."""

	output = io.StringIO()
	writer = csv.writer(output)
	writer.writerow(["section", "field", "value"])

	def write(section: str, field: str, value: Any) -> None:
		if value is None:
			return
		if isinstance(value, (list, tuple)):
			value = "; ".join(str(item) for item in value)
		elif isinstance(value, dict):
			value = json.dumps(value, default=str)
		writer.writerow([section, field, value])

	for key, value in report.items():
		if key == "members":
			continue
		if isinstance(value, dict):
			for sub_key, sub_value in value.items():
				write(key, sub_key, sub_value)
		elif isinstance(value, list):
			write(key, key, value)
		else:
			write("meta", key, value)

	for index, member in enumerate(report.get("members") or [], start=1):
		if isinstance(member, dict):
			for sub_key, sub_value in member.items():
				write("member", f"{index}.{sub_key}", sub_value)

	return output.getvalue()


# ============================================================
# MARKDOWN
# ============================================================

def _md_table(rows: list[tuple[str, Any]]) -> str:
	lines = ["| Field | Value |", "| --- | --- |"]
	for key, value in rows:
		if value is None:
			value = ""
		if isinstance(value, (list, tuple)):
			value = ", ".join(str(item) for item in value)
		elif isinstance(value, dict):
			value = json.dumps(value, default=str)
		lines.append(f"| {key} | {str(value).replace('|', '/')} |")
	return "\n".join(lines)


def render_markdown(report: dict[str, Any]) -> str:
	lines: list[str] = []
	lines.append(f"# {report.get('title')}")
	lines.append("")
	lines.append(f"**Report ID:** {report.get('report_id')}")
	lines.append(f"**Type:** {report.get('report_type')}")
	lines.append(f"**Generated:** {report.get('generated_at')}")
	lines.append(f"**Severity:** {report.get('severity')}")
	lines.append("")

	if report.get("report_type") == "campaign":
		campaign = report.get("campaign") or {}
		lines.append("## Campaign")
		lines.append(_md_table([
			("Campaign ID", campaign.get("campaign_id")),
			("Status", campaign.get("status")),
			("First seen", campaign.get("first_seen")),
			("Last seen", campaign.get("last_seen")),
			("Tenants", campaign.get("tenant_count")),
			("Emails", campaign.get("email_count")),
			("Average similarity", campaign.get("average_similarity")),
		]))
		lines.append("")
		lines.append("## Summary")
		lines.append(str(campaign.get("summary") or ""))
		lines.append("")
		lines.append("## Tenants")
		for tenant in report.get("tenants") or []:
			lines.append(f"- {tenant}")
		return "\n".join(lines)

	message = report.get("message") or {}
	risk = report.get("risk") or {}
	advisory = report.get("advisory") or {}

	lines.append("## Risk")
	lines.append(_md_table([
		("Base score", f"{risk.get('base_score')} / {risk.get('max_score')}"),
		("Severity", risk.get("severity")),
		("Status", risk.get("status")),
	]))
	lines.append("")

	lines.append("## Message")
	lines.append(_md_table([
		("Message-ID", message.get("message_id")),
		("From", message.get("from")),
		("To", message.get("to")),
		("Subject", message.get("subject")),
	]))
	lines.append("")

	lines.append("## Authentication (Layer 1)")
	auth_rows = []
	for name, check in (report.get("authentication") or {}).items():
		if isinstance(check, dict):
			auth_rows.append((name.upper(), f"{check.get('status')} - {check.get('reason')} (score {check.get('score')})"))
	lines.append(_md_table(auth_rows) if auth_rows else "_No authentication data._")
	lines.append("")

	lines.append("## Findings")
	if report.get("findings"):
		for finding in report["findings"]:
			lines.append(f"- {finding}")
	else:
		lines.append("_No findings._")
	lines.append("")

	lines.append("## Advisory")
	lines.append(str(advisory.get("summary") or ""))
	lines.append("")
	for action in advisory.get("recommended_actions") or []:
		lines.append(f"- {action}")
	lines.append("")

	lines.append("## URLs")
	if report.get("urls"):
		for url in report["urls"]:
			lines.append(f"- {url}")
	else:
		lines.append("_No URLs._")
	lines.append("")

	lines.append("## Attachments")
	if report.get("attachments"):
		for attachment in report["attachments"]:
			if isinstance(attachment, dict):
				lines.append(f"- {attachment.get('filename')} ({attachment.get('content_type')}, {attachment.get('size')} bytes)")
	else:
		lines.append("_No attachments._")

	return "\n".join(lines)


# ============================================================
# HTML
# ============================================================

_SEVERITY_COLORS = {
	"high": "#e5484d",
	"medium": "#f5a524",
	"low": "#30a46c",
}


def _html_list(items: Any, empty: str) -> str:
	values = [str(item) for item in _as_list(items) if item not in (None, "")]
	if not values:
		return f'<p class="muted">{escape(empty)}</p>'
	return "<ul>" + "".join(f"<li>{escape(value)}</li>" for value in values) + "</ul>"


def _html_table(rows: list[tuple[str, Any]]) -> str:
	body = []
	for key, value in rows:
		if value is None:
			value = ""
		if isinstance(value, (list, tuple)):
			value = ", ".join(str(item) for item in value)
		elif isinstance(value, dict):
			value = json.dumps(value, default=str)
		body.append(f"<tr><th>{escape(str(key))}</th><td>{escape(str(value))}</td></tr>")
	return '<table class="kv">' + "".join(body) + "</table>"


def _html_style(color: str) -> str:
	return (
		"body{font-family:Segoe UI,Arial,sans-serif;background:#0f1115;color:#e6e6e6;margin:0;padding:32px;}"
		".wrap{max-width:900px;margin:0 auto;}"
		"h1{font-size:22px;margin:0 0 4px;}"
		"h2{font-size:15px;margin:28px 0 8px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.06em;}"
		".muted{color:#7a7f85;font-style:italic;}"
		".badge{display:inline-block;padding:3px 12px;border-radius:999px;font-weight:600;color:#0f1115;background:" + color + ";}"
		".meta{color:#9aa0a6;font-size:13px;margin-bottom:18px;}"
		".card{background:#171a21;border:1px solid #23262e;border-radius:10px;padding:16px 18px;}"
		"table.kv{width:100%;border-collapse:collapse;}"
		"table.kv th{text-align:left;color:#9aa0a6;font-weight:500;padding:6px 12px 6px 0;width:220px;vertical-align:top;}"
		"table.kv td{padding:6px 0;word-break:break-word;}"
		"ul{margin:6px 0;padding-left:20px;}"
		"li{margin:4px 0;}"
		"code{background:#23262e;padding:2px 6px;border-radius:4px;font-size:12px;}"
	)


def render_html(report: dict[str, Any]) -> str:
	severity = str(report.get("severity") or "low")
	color = _SEVERITY_COLORS.get(severity, "#8b8b8b")

	parts: list[str] = []
	parts.append("<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'>")
	parts.append(f"<title>{escape(str(report.get('title')))}</title>")
	parts.append("<style>" + _html_style(color) + "</style></head><body><div class='wrap'>")
	parts.append(f"<h1>{escape(str(report.get('title')))}</h1>")
	parts.append(
		f"<div class='meta'>Report <code>{escape(str(report.get('report_id')))}</code> &middot; "
		f"{escape(str(report.get('report_type')))} &middot; generated {escape(str(report.get('generated_at')))}</div>"
	)
	parts.append(f"<span class='badge'>{escape(severity.upper())}</span>")

	if report.get("report_type") == "campaign":
		campaign = report.get("campaign") or {}
		parts.append("<h2>Campaign</h2><div class='card'>")
		parts.append(_html_table([
			("Campaign ID", campaign.get("campaign_id")),
			("Status", campaign.get("status")),
			("First seen", campaign.get("first_seen")),
			("Last seen", campaign.get("last_seen")),
			("Tenants", campaign.get("tenant_count")),
			("Emails", campaign.get("email_count")),
			("Average similarity", campaign.get("average_similarity")),
		]))
		parts.append("</div>")
		parts.append("<h2>Summary</h2><div class='card'><p>" + escape(str(campaign.get("summary") or "")) + "</p></div>")
		parts.append("<h2>Tenants</h2><div class='card'>" + _html_list(report.get("tenants"), "None") + "</div>")
		parts.append("</div></body></html>")
		return "".join(parts)

	message = report.get("message") or {}
	risk = report.get("risk") or {}
	advisory = report.get("advisory") or {}
	fingerprint = report.get("fingerprint") or {}

	parts.append("<h2>Risk</h2><div class='card'>")
	parts.append(_html_table([
		("Base score", f"{risk.get('base_score')} / {risk.get('max_score')}"),
		("Severity", risk.get("severity")),
		("Status", risk.get("status")),
	]))
	parts.append("</div>")

	parts.append("<h2>Message</h2><div class='card'>")
	parts.append(_html_table([
		("Message-ID", message.get("message_id")),
		("From", message.get("from")),
		("To", message.get("to")),
		("Subject", message.get("subject")),
	]))
	parts.append("</div>")

	parts.append("<h2>Authentication (Layer 1)</h2><div class='card'>")
	auth_rows = []
	for name, check in (report.get("authentication") or {}).items():
		if isinstance(check, dict):
			auth_rows.append((name.upper(), f"{check.get('status')} - {check.get('reason')} (score {check.get('score')})"))
	parts.append(_html_table(auth_rows) if auth_rows else "<p class='muted'>No authentication data.</p>")
	parts.append("</div>")

	parts.append("<h2>Findings</h2><div class='card'>" + _html_list(report.get("findings"), "No findings.") + "</div>")
	parts.append("<h2>Advisory</h2><div class='card'><p>" + escape(str(advisory.get("summary") or "")) + "</p>"
	             + _html_list(advisory.get("recommended_actions"), "No actions.") + "</div>")

	parts.append("<h2>URLs</h2><div class='card'>" + _html_list(report.get("urls"), "No URLs.") + "</div>")

	attachment_items = []
	for attachment in report.get("attachments") or []:
		if isinstance(attachment, dict):
			attachment_items.append(
				f"{attachment.get('filename')} ({attachment.get('content_type')}, {attachment.get('size')} bytes)"
			)
	parts.append("<h2>Attachments</h2><div class='card'>" + _html_list(attachment_items, "No attachments.") + "</div>")

	parts.append("<h2>Fingerprint</h2><div class='card'>")
	parts.append(_html_table([
		("Body SHA-256", fingerprint.get("body_sha256")),
		("TLSH", fingerprint.get("tlsh")),
		("PII redactions", fingerprint.get("pii_redactions")),
		("IOC count", fingerprint.get("ioc_count")),
	]))
	parts.append("</div>")

	parts.append("</div></body></html>")
	return "".join(parts)