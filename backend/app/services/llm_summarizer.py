from __future__ import annotations

import asyncio
import csv
import io
import json
from dataclasses import dataclass

import httpx

from app.config import GROQ_API_KEY, GROQ_MODEL, LLM_PROVIDER, LLM_TIMEOUT_SECONDS, OLLAMA_MODEL, OLLAMA_URL


@dataclass
class AdvisoryResult:
	status: str
	summary: str
	recommended_actions: list[str]


def _fallback_advisory(score: int, findings: list[str]) -> AdvisoryResult:
	if score >= 50:
		status = "high"
		actions = ["Quarantine the message", "Review URLs and attachments", "Notify the security team"]
	elif score >= 25:
		status = "medium"
		actions = ["Hold for analyst review", "Verify the sender through a trusted channel"]
	else:
		status = "low"
		actions = ["Allow delivery with monitoring"]

	finding_text = ", ".join(findings) if findings else "no high-confidence indicators"
	return AdvisoryResult(status, f"Risk is {status} with a base score of {score}/70. Detected indicators: {finding_text}.", actions)


def _groq_advisory(score: int, findings: list[str], body: str) -> AdvisoryResult:
	from groq import Groq

	client = Groq(api_key=GROQ_API_KEY)
	response = client.chat.completions.create(
		model=GROQ_MODEL,
		temperature=0,
		max_tokens=180,
		response_format={"type": "json_object"},
		messages=[
			{"role": "system", "content": "Return JSON with exactly: status, summary, recommended_actions. Summary must be exactly two sentences."},
			{"role": "user", "content": json.dumps({"score": score, "findings": findings, "body": body[:4000]})},
		],
	)
	data = json.loads(response.choices[0].message.content)
	return AdvisoryResult(str(data["status"]), str(data["summary"]), [str(item) for item in data["recommended_actions"]])


def _ollama_advisory(score: int, findings: list[str], body: str) -> AdvisoryResult:
	prompt = json.dumps({"score": score, "findings": findings, "body": body[:4000]})
	response = httpx.post(
		OLLAMA_URL,
		json={
			"model": OLLAMA_MODEL,
			"stream": False,
			"format": "json",
			"options": {"temperature": 0},
			"messages": [
				{"role": "system", "content": "Return JSON with exactly: status, summary, recommended_actions. Summary must be exactly two sentences."},
				{"role": "user", "content": prompt},
			],
		},
		timeout=LLM_TIMEOUT_SECONDS,
	)
	response.raise_for_status()
	data = response.json()["message"]["content"]
	if isinstance(data, str):
		data = json.loads(data)
	return AdvisoryResult(str(data["status"]), str(data["summary"]), [str(item) for item in data["recommended_actions"]])


async def generate_threat_advisory(score: int, findings: list[str], body: str) -> AdvisoryResult:
	provider = LLM_PROVIDER
	if provider == "groq" and not GROQ_API_KEY:
		return _fallback_advisory(score, findings)
	if provider not in {"ollama", "groq"}:
		return _fallback_advisory(score, findings)
	try:
		advisory_function = _ollama_advisory if provider == "ollama" else _groq_advisory
		return await asyncio.wait_for(asyncio.to_thread(advisory_function, score, findings, body), timeout=LLM_TIMEOUT_SECONDS + 1)
	except Exception:
		return _fallback_advisory(score, findings)


def advisory_exports(advisory: AdvisoryResult, score: int, message_id: str | None) -> tuple[dict[str, object], str]:
	data = {
		"message_id": message_id,
		"risk_score": score,
		"status": advisory.status,
		"summary": advisory.summary,
		"recommended_actions": advisory.recommended_actions,
	}
	output = io.StringIO()
	writer = csv.DictWriter(output, fieldnames=["message_id", "risk_score", "status", "summary", "recommended_actions"])
	writer.writeheader()
	writer.writerow({**data, "recommended_actions": "; ".join(advisory.recommended_actions)})
	return data, output.getvalue()
