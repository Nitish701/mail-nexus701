import asyncio
import hmac

from fastapi import FastAPI, HTTPException, Request

from app.config import LAYER_TIMEOUT_SECONDS, MODEL_PATH, WEBHOOK_SECRET
from app.engine.layer1_auth import validate_authentication
from app.engine.layer2_heuristics import scan_heuristics
from app.engine.layer3_ml import BodyTextModel
from app.engine.layer4_yara import StaticScanResult, scan_attachments
from app.engine.parser import parse_mime
from app.fingerprint import build_email_fingerprint
from app.services.llm_summarizer import advisory_exports, generate_threat_advisory
from app.schemas import Attachment, AuthenticationCheck, InboundEmailResponse, LayerCheck, ThreatAdvisory


app = FastAPI(title="Mail-Nexus API", version="0.1.0")
MAX_EMAIL_BYTES = 25 * 1024 * 1024
body_text_model = BodyTextModel(MODEL_PATH)


async def _scan_static_with_budget(attachments) -> StaticScanResult:
	try:
		return await asyncio.wait_for(scan_attachments(attachments), timeout=LAYER_TIMEOUT_SECONDS)
	except asyncio.TimeoutError:
		return StaticScanResult("timeout", 0, ["Static checks exceeded latency budget"], {})


@app.get("/health")
async def health() -> dict[str, str]:
	return {"status": "ok"}


@app.post("/api/v1/inbound", response_model=InboundEmailResponse)
@app.post("/webhooks/email", response_model=InboundEmailResponse)
async def inbound_email(request: Request) -> InboundEmailResponse:
	if WEBHOOK_SECRET:
		authorization = request.headers.get("authorization", "")
		expected = f"Bearer {WEBHOOK_SECRET}"
		if not hmac.compare_digest(authorization, expected):
			raise HTTPException(status_code=401, detail="Invalid webhook secret")

	content_length = request.headers.get("content-length")
	if content_length and int(content_length) > MAX_EMAIL_BYTES:
		raise HTTPException(status_code=413, detail="Email payload exceeds 25 MiB")

	raw_message = await request.body()
	if not raw_message:
		raise HTTPException(status_code=400, detail="Email payload is empty")
	if len(raw_message) > MAX_EMAIL_BYTES:
		raise HTTPException(status_code=413, detail="Email payload exceeds 25 MiB")

	try:
		parsed = parse_mime(raw_message)
	except (TypeError, ValueError) as error:
		raise HTTPException(status_code=400, detail="Invalid MIME payload") from error

	authentication = validate_authentication(parsed)
	heuristic_findings, heuristic_score = scan_heuristics(parsed)
	authentication_score = sum(int(result["score"]) for result in authentication.values())
	ml_result, static_result = await asyncio.gather(
		asyncio.to_thread(body_text_model.score, parsed.subject_and_body),
		_scan_static_with_budget(parsed.attachments),
	)
	base_score = min(authentication_score + heuristic_score + ml_result.score + static_result.score, 70)
	fingerprint = build_email_fingerprint(parsed)
	all_findings = heuristic_findings + static_result.findings
	advisory = await generate_threat_advisory(base_score, all_findings, fingerprint.redacted_body)
	advisory_json, advisory_csv = advisory_exports(advisory, base_score, parsed.message_id)

	return InboundEmailResponse(
		message_id=parsed.message_id,
		from_address=parsed.from_address,
		to_addresses=parsed.to_addresses,
		subject=parsed.subject,
		headers=parsed.headers,
		urls=parsed.urls,
		attachments=[Attachment(filename=attachment.filename, content_type=attachment.content_type, size=attachment.size, disposition=attachment.disposition) for attachment in parsed.attachments],
		authentication={key: AuthenticationCheck(**value) for key, value in authentication.items()},
		heuristic_findings=heuristic_findings,
		layers={
			"layer3_ml": LayerCheck(status=ml_result.status, score=ml_result.score, probability=ml_result.probability, reason=ml_result.reason),
			"layer4_static": LayerCheck(status=static_result.status, score=static_result.score, findings=static_result.findings),
		},
		virustotal=static_result.virus_total,
		fingerprint=fingerprint,
		threat_advisory=ThreatAdvisory(
			status=advisory.status,
			summary=advisory.summary,
			recommended_actions=advisory.recommended_actions,
			json_export=advisory_json,
			csv=advisory_csv,
		),
		base_score=base_score,
	)
