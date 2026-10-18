from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
from dataclasses import dataclass, replace
from typing import Any

import httpx

from app.config import GROQ_API_KEY, GROQ_MODEL, LLM_PROVIDER, LLM_TIMEOUT_SECONDS, OLLAMA_MODEL, OLLAMA_URL
from app.fingerprint.pii_sanitizer import redact_sensitive_message


logger = logging.getLogger(__name__)
MAX_REPORT_BODY_CHARS = 1800
MAX_REPORT_TOKENS = 100
SYSTEM_PROMPT = """You explain a risk disposition to a non-technical reader. The supplied basis
is the complete set of facts you may use. Do not add email details, findings, diagnoses, or actions.
Do not change the risk decision or imply that an automated score proves an email is safe or harmful.
Return valid JSON with exactly one field: explanation, a plain-language explanation in 1 or 2
short sentences (25-55 words)."""


@dataclass
class AdvisoryResult:
	status: str
	summary: str
	recommended_actions: list[str]
	detailed_report: str = ""
	ai_status: str = "not_requested"


def _fallback_advisory(
	score: int,
	findings: list[str],
	evidence: dict[str, Any] | None = None,
) -> AdvisoryResult:
	if score >= 50:
		status = "high"
		actions = ["Quarantine the message", "Review URLs and attachments", "Notify the security team"]
	elif score >= 25:
		status = "medium"
		actions = ["Hold for analyst review", "Verify the sender through a trusted channel"]
	elif (evidence or {}).get("final_system_decision", {}).get("disposition") == "review":
		status = "review"
		actions = [
			"Hold for analyst review",
			"Verify the sender through a trusted channel",
			"Do not quarantine solely on the ML score",
		]
	else:
		status = "low"
		actions = ["Allow delivery with monitoring"]

	finding_text = "\n".join(f"- {finding}" for finding in findings) if findings else "- No specific heuristic or static findings were reported."
	context = evidence or {}
	message = context.get("message", {})
	subject = message.get("subject", "Subject unavailable") if isinstance(message, dict) else "Subject unavailable"
	sender_domain = message.get("sender_domain", "Sender domain unavailable") if isinstance(message, dict) else "Sender domain unavailable"
	body_excerpt = str(context.get("email_body_redacted") or "").strip()
	if len(body_excerpt) > 1200:
		body_excerpt = body_excerpt[:1200] + "..."

	def message_items_text(field: str, empty_text: str) -> str:
		items = message.get(field) if isinstance(message, dict) else None
		if not isinstance(items, list):
			return "Unavailable."
		if not items:
			return empty_text
		formatted: list[str] = []
		for item in items[:10]:
			if isinstance(item, dict):
				formatted.append(
					", ".join(
						str(item[key])
						for key in ("filename", "content_type", "size_bytes")
						if item.get(key) is not None
					) or "Details unavailable"
				)
			else:
				formatted.append(str(item)[:250])
		if len(items) > 10:
			formatted.append(f"and {len(items) - 10} more")
		return "; ".join(formatted)

	auth_lines = context.get("authentication", {})
	auth_text = "\n".join(
		f"- {name.upper()}: {check.get('status', 'unknown')} — {check.get('reason', 'No explanation supplied')}."
		for name, check in auth_lines.items()
	) if isinstance(auth_lines, dict) and auth_lines else "- Authentication results were unavailable."
	layer_lines = context.get("layers", {})
	formatted_layers: list[str] = []
	if isinstance(layer_lines, dict):
		for name, layer in layer_lines.items():
			if not isinstance(layer, dict):
				continue
			if name == "infrastructure":
				parts = [
					"suspicious indicator reported" if layer.get("suspicious") else "no suspicious indicator reported"
				]
				parts.extend(
					f"{field} {layer[field]}"
					for field in ("country", "asn", "confidence")
					if layer.get(field) is not None
				)
				formatted_layers.append(f"- Infrastructure: {'; '.join(parts)}.")
				continue
			details = [f"score {layer.get('score', 'unavailable')}"]
			if layer.get("status") is not None:
				details.append(f"status {layer['status']}")
			if name == "ml" and isinstance(layer.get("probability"), (float, int)):
				details.append(f"model signal {layer['probability']} (not calibrated)")
			if layer.get("reason"):
				details.append(str(layer["reason"]))
			if isinstance(layer.get("findings"), list) and layer["findings"]:
				details.append("; ".join(str(item) for item in layer["findings"][:10]))
			formatted_layers.append(f"- {name}: {'; '.join(details)}.")
	layer_text = "\n".join(formatted_layers) if formatted_layers else "- Layer-level details were unavailable."

	virus_total_text = "No VirusTotal result was available."
	virus_total = context.get("virus_total")
	if isinstance(virus_total, dict):
		for payload in virus_total.values():
			try:
				document = json.loads(payload) if isinstance(payload, str) else payload
			except (json.JSONDecodeError, TypeError):
				continue
			data = document.get("data") if isinstance(document, dict) else None
			attributes = data.get("attributes") if isinstance(data, dict) else None
			stats = attributes.get("last_analysis_stats") if isinstance(attributes, dict) else None
			if isinstance(stats, dict):
				virus_total_text = (
					f"VirusTotal: {stats.get('malicious', 0)} malicious and "
					f"{stats.get('suspicious', 0)} suspicious detections."
				)
				break
	detailed_report = (
		"Message overview\n"
		f"The system assigned a {status} disposition and a combined risk score of {score}/70. "
		"This report summarizes the evidence available to the automated checks. "
		f"The subject is “{subject}”; the sender domain is {sender_domain}.\n"
		f"URLs found: {message_items_text('urls', 'None detected.')}\n"
		f"Attachments found: {message_items_text('attachments', 'None detected.')}\n"
		+ (f"Redacted message excerpt: {body_excerpt}\n\n" if body_excerpt else "Message content was unavailable to the report generator.\n\n")
		+ "What the checks found\n"
		+ f"{layer_text}\n"
		+ f"{auth_text}\n"
		+ f"- {virus_total_text}\n"
		+ f"Additional findings:\n{finding_text}\n\n"
		+ "Why this decision\n"
		+ f"The disposition follows the combined risk score ({score}/70), not a single model result. "
		+ "Authentication can support sender legitimacy, but it does not prove message content is safe.\n\n"
		+ "Uncertainty\n"
		+ "Automated checks can miss new attacks or flag unusual legitimate messages. "
		+ "Unavailable signals should not be treated as passing checks.\n\n"
		+ "Recommended next steps\n"
		+ "\n".join(f"- {action}" for action in actions)
	)
	detailed_report = redact_sensitive_message(detailed_report).text
	return AdvisoryResult(
		status,
		redact_sensitive_message(
			f"Risk disposition is {status} with a combined score of {score}/70. "
			"See the detailed report for the evidence and recommended next steps."
		).text,
		actions,
		detailed_report,
		"pending",
	)


def _parse_advisory_response(content: Any, fallback: AdvisoryResult) -> AdvisoryResult:
	if isinstance(content, str):
		data = json.loads(content)
	elif isinstance(content, dict):
		data = content
	else:
		raise ValueError("AI advisory response must be a JSON object")
	explanation = data.get("explanation")
	if not isinstance(explanation, str) or not 40 <= len(explanation.strip()) <= 400:
		raise ValueError("AI advisory explanation is missing or outside the allowed length")

	explanation = redact_sensitive_message(explanation.strip()).text

	report = (
		"Plain-language explanation\n"
		+ explanation
		+ "\n\nVerified scan evidence and recommended next steps\n"
		+ fallback.detailed_report
	)
	return AdvisoryResult(
		fallback.status,
		fallback.summary,
		fallback.recommended_actions,
		redact_sensitive_message(report).text,
		"complete",
	)


def _explanation_basis(status: str, score: int) -> str:
	bases = {
		"low": (
			"The system assigned low risk based on its combined automated checks. "
			"A low score is not a guarantee that an email is safe."
		),
		"medium": (
			"The system assigned medium risk based on its combined automated checks. "
			"Review the evidence before trusting the email; the score alone does not prove it is harmful."
		),
		"high": (
			"The system assigned high risk based on its combined automated checks. "
			"Follow the recommended protective actions; the score is an automated assessment."
		),
		"review": (
			"The email needs analyst review because the ML signal is strong but independent checks "
			"do not justify automatic quarantine on their own."
		),
	}
	return f"Disposition: {status}. Combined score: {score}/70. {bases[status]}"


def _groq_advisory(fallback: AdvisoryResult, score: int) -> AdvisoryResult:
	from groq import Groq

	client = Groq(api_key=GROQ_API_KEY)
	response = client.chat.completions.create(
		model=GROQ_MODEL,
		temperature=0,
		max_tokens=MAX_REPORT_TOKENS,
		response_format={"type": "json_object"},
		messages=[
			{"role": "system", "content": SYSTEM_PROMPT},
			{
				"role": "user",
				"content": json.dumps(
					{"decision_basis": _explanation_basis(fallback.status, score)},
					ensure_ascii=True,
				),
			},
		],
	)
	return _parse_advisory_response(response.choices[0].message.content, fallback)


def _ollama_advisory(fallback: AdvisoryResult, score: int) -> AdvisoryResult:
	prompt = json.dumps(
		{"decision_basis": _explanation_basis(fallback.status, score)},
		ensure_ascii=True,
	)
	response = httpx.post(
		OLLAMA_URL,
		json={
			"model": OLLAMA_MODEL,
			"stream": False,
			"format": "json",
			"options": {"temperature": 0, "num_predict": MAX_REPORT_TOKENS},
			"messages": [
				{"role": "system", "content": SYSTEM_PROMPT},
				{"role": "user", "content": prompt},
			],
		},
		timeout=LLM_TIMEOUT_SECONDS,
	)
	response.raise_for_status()
	data = response.json()["message"]["content"]
	return _parse_advisory_response(data, fallback)


def _safe_evidence(evidence: dict[str, Any] | None, body: str) -> dict[str, Any]:
	def sanitize(value: Any) -> Any:
		if isinstance(value, str):
			return redact_sensitive_message(value).text
		if isinstance(value, list):
			return [sanitize(item) for item in value]
		if isinstance(value, dict):
			return {str(key): sanitize(item) for key, item in value.items()}
		return value

	safe = sanitize(evidence or {})
	safe["email_body_redacted"] = redact_sensitive_message(body[:MAX_REPORT_BODY_CHARS]).text
	return safe


def build_deterministic_advisory(
	score: int,
	findings: list[str],
	body: str,
	evidence: dict[str, Any] | None = None,
) -> AdvisoryResult:
	safe_evidence = _safe_evidence(evidence, body)
	return _fallback_advisory(score, findings, safe_evidence)


async def generate_ai_explanation(fallback: AdvisoryResult, score: int) -> AdvisoryResult:
	provider = LLM_PROVIDER
	if provider == "groq" and not GROQ_API_KEY:
		logger.warning("Groq advisory requested but GROQ_API_KEY is not configured; using deterministic report")
		return replace(fallback, ai_status="fallback")
	if provider not in {"ollama", "groq"}:
		logger.warning("Unsupported LLM_PROVIDER %r; using deterministic report", provider)
		return replace(fallback, ai_status="fallback")
	try:
		advisory_function = _ollama_advisory if provider == "ollama" else _groq_advisory
		return await asyncio.wait_for(
			asyncio.to_thread(advisory_function, fallback, score),
			timeout=LLM_TIMEOUT_SECONDS + 1,
		)
	except Exception as error:
		logger.warning("AI advisory generation failed; using deterministic report: %s", error)
		return replace(fallback, ai_status="fallback")


def enforce_risk_disposition(
	advisory: AdvisoryResult,
	disposition: str,
	score: int,
	ml_probability: float | None,
) -> AdvisoryResult:
	if disposition not in {"low", "medium", "high", "review"}:
		raise ValueError(f"Unsupported risk disposition: {disposition}")

	if disposition == "review":
		if ml_probability is None:
			raise ValueError("Review disposition requires an ML probability")
		advisory.status = "review"
		advisory.summary = (
			f"The email needs analyst review: the ML model flagged it strongly, "
			f"but independent signals produce a combined score of {score}/70 and do not justify automatic quarantine."
		)
		advisory.recommended_actions = [
			"Hold for analyst review",
			"Verify the sender through a trusted channel",
			"Do not quarantine solely on the ML score",
		]
	elif advisory.status.lower() != disposition:
		advisory.status = disposition
		advisory.summary = (
			f"The system assigned a {disposition} disposition with a combined score of "
			f"{score}/70, based on the deterministic scoring policy."
		)
		advisory.recommended_actions = {
			"low": ["Allow delivery with monitoring"],
			"medium": ["Hold for analyst review", "Verify the sender through a trusted channel"],
			"high": ["Quarantine the message", "Review URLs and attachments", "Notify the security team"],
		}[disposition]
	advisory.status = disposition
	advisory.detailed_report = (
		f"System decision: {disposition.upper()} (combined risk score {score}/70). "
		"The decision is based on the deterministic scoring policy; an optional AI explanation "
		"only clarifies the decision and cannot change the score.\n\n"
		+ advisory.detailed_report
	)
	return advisory


def advisory_exports(advisory: AdvisoryResult, score: int, message_id: str | None) -> tuple[dict[str, object], str]:
	data = {
		"message_id": message_id,
		"risk_score": score,
		"status": advisory.status,
		"summary": advisory.summary,
		"detailed_report": advisory.detailed_report,
		"recommended_actions": advisory.recommended_actions,
		"ai_status": advisory.ai_status,
	}
	output = io.StringIO()
	writer = csv.DictWriter(output, fieldnames=["message_id", "risk_score", "status", "summary", "detailed_report", "recommended_actions", "ai_status"])
	writer.writeheader()
	writer.writerow({**data, "recommended_actions": "; ".join(advisory.recommended_actions)})
	return data, output.getvalue()
