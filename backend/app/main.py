import asyncio
import hmac
import logging
import re
import threading
from email.utils import parseaddr

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text, select
from sqlalchemy.orm import Session

from app.config import (
	COLLEGE_DOMAINS,
	CORS_ORIGINS,
	LAYER_TIMEOUT_SECONDS,
    MAX_EMAIL_BYTES,
    MODEL_PATH,
    VIRUSTOTAL_API_KEY,
    VIRUSTOTAL_TIMEOUT_SECONDS,
    WEBHOOK_SECRET,
)
from app.developer2.database import Base, engine, get_db
from app.developer2 import models as developer2_models
from app.developer2.router import router as developer2_router, submit_fingerprint
from app.developer2.geo import enrich_ip, location_note, private_relay_note
from app.developer2.schemas import FingerprintEvent
from app.reports.router import router as reports_router
from app.services import report_generator, report_store
from app.engine.layer1_auth import has_trusted_authentication, validate_authentication
from app.engine.layer2_heuristics import scan_heuristics
from app.engine.layer3_ml import BodyTextModel
from app.engine.layer4_yara import StaticScanResult, scan_attachments
from app.engine.parser import parse_mime
from app.engine.risk_scoring import calculate_risk_score, classify_risk_disposition
from app.fingerprint import build_email_fingerprint
from app.services.llm_summarizer import (
	AdvisoryResult,
	advisory_exports,
	build_deterministic_advisory,
	enforce_risk_disposition,
	generate_ai_explanation,
)
from app.schemas import Attachment, AuthenticationCheck, InboundEmailResponse, LayerCheck, ThreatAdvisory


app = FastAPI(title="Mail-Nexus API", version="0.1.0")
logger = logging.getLogger("mail_nexus.ingestion")
<<<<<<< HEAD
MAX_EMAIL_BYTES = 25 * 1024 * 1024
_AI_EXPLANATION_LOCK = threading.Lock()
=======
>>>>>>> b7b7db0 (Update project features)
body_text_model = BodyTextModel(MODEL_PATH)
Base.metadata.create_all(bind=engine)
report_store.ReportBase.metadata.create_all(bind=engine)


def _ensure_column(table: str, column: str, definition: str) -> None:
	if table not in inspect(engine).get_table_names():
		return
	if column not in {item["name"] for item in inspect(engine).get_columns(table)}:
		with engine.begin() as connection:
			connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


for _table in ("dev2_emails", "dev2_fingerprints", "dev2_campaigns"):
	_ensure_column(_table, "organization_id", "INTEGER")
_ensure_column("mail_nexus_reports", "organization_id", "INTEGER")


def _seed_legacy_organization() -> None:
	if not COLLEGE_DOMAINS:
		return
	with Session(bind=engine) as session:
		existing = session.execute(select(developer2_models.OrganizationDomain).where(developer2_models.OrganizationDomain.domain.in_(COLLEGE_DOMAINS))).scalars().first()
		if existing:
			return
		organization = developer2_models.Organization(name="EduShield", description="Migrated configured domains")
		organization.domains = [developer2_models.OrganizationDomain(domain=domain) for domain in sorted(COLLEGE_DOMAINS)]
		session.add(organization)
		session.commit()


_seed_legacy_organization()
app.include_router(developer2_router)
app.include_router(reports_router)
app.add_middleware(
	CORSMiddleware,
	allow_origins=CORS_ORIGINS,
	allow_credentials=False,
	allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
	allow_headers=["*"]
)


def _normalize_domain(value: str) -> str:
	return value.strip().lower().rstrip(".")


def _validate_domain(value: str) -> str:
	domain = _normalize_domain(value)
	if not re.fullmatch(r"(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", domain):
		raise HTTPException(status_code=400, detail="Invalid domain")
	return domain


def _organization_for_recipients(db: Session, recipients: list[str]) -> developer2_models.Organization | None:
	domains = {_normalize_domain(parseaddr(address)[1].rsplit("@", 1)[1]) for address in recipients if "@" in parseaddr(address)[1]}
	if not domains:
		return None
	# Organization names also provide stable mail aliases such as
	# organization-a@edushield1.in without requiring a separate DNS zone.
	local_parts = {parseaddr(address)[1].split("@", 1)[0].lower() for address in recipients if "@" in parseaddr(address)[1]}
	organizations = db.execute(select(developer2_models.Organization)).scalars().unique().all()
	for organization in organizations:
		slug = re.sub(r"[^a-z0-9]+", "-", organization.name.lower()).strip("-")
		if slug in local_parts:
			return organization
	organizations = db.execute(
		select(developer2_models.Organization)
		.join(developer2_models.OrganizationDomain)
		.where(developer2_models.OrganizationDomain.domain.in_(domains))
	).scalars().unique().all()
	return organizations[0] if len(organizations) == 1 else None


def _ingestion_recipients(request: Request, parsed_recipients: list[str]) -> list[str]:
	"""Use Cloudflare's envelope recipient when the RFC822 To header differs."""
	recipients = list(parsed_recipients)
	envelope = request.headers.get("x-mail-nexus-to", "")
	if envelope:
		address = parseaddr(envelope)[1]
		if address:
			recipients.append(address)
	return list(dict.fromkeys(address.strip().lower() for address in recipients if address.strip()))


def _tenant_id(organization: developer2_models.Organization | None, recipients: list[str], request: Request) -> str:
	if organization:
		return f"organization:{organization.id}"
	for address in recipients:
		parsed_address = parseaddr(address)[1]
		if "@" in parsed_address:
			return f"domain:{parsed_address.rsplit('@', 1)[1].lower()}"
	return request.headers.get("x-mail-nexus-tenant-id", "unassigned")


@app.post("/api/organizations")
async def register_organization(payload: dict[str, object], db: Session = Depends(get_db)) -> dict[str, object]:
	name = str(payload.get("name", "")).strip()
	domains = sorted({_validate_domain(str(domain)) for domain in (payload.get("domains") or [])})
	if not name or not domains:
		raise HTTPException(status_code=400, detail="Organization name and at least one domain are required")
	existing = db.execute(select(developer2_models.OrganizationDomain).where(developer2_models.OrganizationDomain.domain.in_(domains))).scalars().first()
	if existing:
		raise HTTPException(status_code=409, detail="One or more domains are already registered")
	organization = developer2_models.Organization(name=name, description=str(payload.get("description") or "").strip() or None)
	organization.domains = [developer2_models.OrganizationDomain(domain=domain) for domain in domains]
	db.add(organization)
	db.commit()
	db.refresh(organization)
	return {"id": organization.id, "name": organization.name, "description": organization.description, "domains": domains}


@app.get("/api/organizations")
async def list_organizations(db: Session = Depends(get_db)) -> list[dict[str, object]]:
	organizations = db.execute(select(developer2_models.Organization).order_by(developer2_models.Organization.name)).scalars().unique().all()
	return [{"id": item.id, "name": item.name, "description": item.description, "domains": [domain.domain for domain in item.domains]} for item in organizations]


@app.post("/api/organizations/verify-domain")
@app.post("/api/college/verify-domain")
async def verify_college_domain(payload: dict[str, str], db: Session = Depends(get_db)) -> dict[str, object]:
	domain = _validate_domain(payload.get("domain", ""))
	organization = db.execute(
		select(developer2_models.Organization)
		.join(developer2_models.OrganizationDomain)
		.where(developer2_models.OrganizationDomain.domain == domain)
	).scalars().unique().first()
	if organization is None:
		# Legacy configured domains remain verifiable until registered data is migrated.
		if domain not in COLLEGE_DOMAINS:
			raise HTTPException(status_code=404, detail="Organization domain is not registered")
		return {"verified": True, "organization_id": None, "domain": domain, "organization_name": domain.split(".")[0].replace("-", " ").title()}
	return {"verified": True, "organization_id": organization.id, "domain": domain, "organization_name": organization.name, "domains": [item.domain for item in organization.domains]}


async def _scan_static_with_budget(attachments) -> StaticScanResult:
	try:
		static_scan_timeout = LAYER_TIMEOUT_SECONDS
		if VIRUSTOTAL_API_KEY:
			static_scan_timeout += VIRUSTOTAL_TIMEOUT_SECONDS
		return await asyncio.wait_for(scan_attachments(attachments), timeout=static_scan_timeout)
	except asyncio.TimeoutError:
		return StaticScanResult("timeout", 10, ["Static checks exceeded latency budget"], {})


def _persist_ai_explanation(report_id: str, advisory: AdvisoryResult) -> None:
	with Session(bind=engine) as background_db:
		updated = report_store.update_report_advisory(
			background_db,
			report_id,
			{
				"status": advisory.status,
				"summary": advisory.summary,
				"detailed_report": advisory.detailed_report,
				"recommended_actions": advisory.recommended_actions,
				"ai_status": advisory.ai_status,
			},
		)
	if not updated:
		logger.warning("AI explanation completed but report %s no longer exists", report_id)


def _generate_ai_explanation_for_report(
	report_id: str,
	advisory: AdvisoryResult,
	score: int,
) -> None:
	if not _AI_EXPLANATION_LOCK.acquire(blocking=False):
		logger.info("Skipping optional AI explanation for report %s; local model is busy", report_id)
		try:
			_persist_ai_explanation(report_id, AdvisoryResult(
				advisory.status,
				advisory.summary,
				advisory.recommended_actions,
				advisory.detailed_report,
				"skipped_busy",
			))
		except Exception:
			logger.exception("Failed to record skipped AI explanation for report %s", report_id)
		return

	try:
		completed = asyncio.run(generate_ai_explanation(advisory, score))
		_persist_ai_explanation(report_id, completed)
	except Exception:
		logger.exception("Failed to generate or save AI explanation for report %s", report_id)
	finally:
		_AI_EXPLANATION_LOCK.release()


@app.get("/health")
async def health() -> dict[str, str]:
	return {"status": "ok"}


@app.post("/api/v1/inbound", response_model=InboundEmailResponse)
@app.post("/webhooks/email", response_model=InboundEmailResponse)
async def inbound_email(
	request: Request,
	background_tasks: BackgroundTasks,
	db: Session = Depends(get_db),
) -> InboundEmailResponse:
	if WEBHOOK_SECRET:
		authorization = request.headers.get("authorization", "")
		expected = f"Bearer {WEBHOOK_SECRET}"
		if not hmac.compare_digest(authorization, expected):
			raise HTTPException(status_code=401, detail="Invalid webhook secret")

	max_size_label = (
		f"{MAX_EMAIL_BYTES // (1024 * 1024)} MiB"
		if MAX_EMAIL_BYTES % (1024 * 1024) == 0
		else f"{MAX_EMAIL_BYTES} bytes"
	)

	content_length = request.headers.get("content-length")
	if content_length:
		try:
			content_length_val = int(content_length)
			if content_length_val > MAX_EMAIL_BYTES:
				raise HTTPException(status_code=413, detail=f"Email payload exceeds {max_size_label}")
			if content_length_val < 0:
				raise HTTPException(status_code=400, detail="Invalid Content-Length header")
		except ValueError as error:
			logger.warning("Rejected email with invalid Content-Length header")
			raise HTTPException(status_code=400, detail="Invalid Content-Length header") from error

	chunks: list[bytes] = []
	total_bytes = 0
	async for chunk in request.stream():
		total_bytes += len(chunk)
		if total_bytes > MAX_EMAIL_BYTES:
			raise HTTPException(status_code=413, detail=f"Email payload exceeds {max_size_label}")
		chunks.append(chunk)

	raw_message = b"".join(chunks)
	request._body = raw_message
	if not raw_message:
		raise HTTPException(status_code=400, detail="Email payload is empty")

	try:
		parsed = parse_mime(raw_message)
	except Exception as error:
		logger.warning("Rejected malformed MIME email", exc_info=error)
		raise HTTPException(status_code=400, detail="Invalid MIME payload") from error
	recipients = _ingestion_recipients(request, parsed.to_addresses)
	organization = _organization_for_recipients(db, recipients)
	tenant_id = _tenant_id(organization, recipients, request)
	private_relay = private_relay_note(parsed.private_relay_ips)

	authentication = validate_authentication(parsed)
	heuristic_findings, heuristic_score = scan_heuristics(parsed)
	geo, ml_result, static_result = await asyncio.gather(
		enrich_ip(parsed.source_ip),
		asyncio.to_thread(body_text_model.score, parsed.subject_and_body),
		_scan_static_with_budget(parsed.attachments),
	)
	suspicious_infrastructure = bool(geo and geo.is_vpn_proxy)
	if suspicious_infrastructure:
		heuristic_findings.append("VPN/proxy/tor sending infrastructure detected")
	base_score = calculate_risk_score(
		authentication,
		heuristic_score,
		ml_result.score,
		static_result.score,
		suspicious_infrastructure,
		parsed.from_domain,
		has_trusted_authentication(parsed),
	)
	risk_disposition = classify_risk_disposition(base_score, ml_result.probability)
	fingerprint = build_email_fingerprint(parsed)
	all_findings = heuristic_findings + static_result.findings
	advisory_evidence = {
		"message": {
			"subject": parsed.subject,
			"sender_domain": parsed.from_domain,
			"urls": parsed.urls,
			"attachments": [
				{
					"filename": attachment.filename,
					"content_type": attachment.content_type,
					"size_bytes": attachment.size,
				}
				for attachment in parsed.attachments
			],
		},
		"authentication": authentication,
		"layers": {
			"heuristics": {"score": heuristic_score, "findings": heuristic_findings},
			"ml": {
				"score": ml_result.score,
				"probability": ml_result.probability,
				"reason": ml_result.reason,
			},
			"static": {
				"score": static_result.score,
				"status": static_result.status,
				"findings": static_result.findings,
			},
			"infrastructure": {
				"suspicious": suspicious_infrastructure,
				"country": geo.country if geo else None,
				"asn": geo.asn if geo else None,
				"confidence": geo.confidence if geo else None,
			},
		},
		"virus_total": static_result.virus_total,
		"final_system_decision": {
			"score": base_score,
			"maximum_score": 70,
			"disposition": risk_disposition,
		},
	}
	advisory = enforce_risk_disposition(
		build_deterministic_advisory(
			base_score,
			all_findings,
			parsed.subject_and_body,
			advisory_evidence,
		),
		risk_disposition,
		base_score,
		ml_result.probability,
	)
	advisory_json, advisory_csv = advisory_exports(advisory, base_score, parsed.message_id)

	response = InboundEmailResponse(
		message_id=parsed.message_id,
		from_address=parsed.from_address,
				to_addresses=recipients,
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
			detailed_report=advisory.detailed_report,
			recommended_actions=advisory.recommended_actions,
			ai_status=advisory.ai_status,
			json_export=advisory_json,
			csv=advisory_csv,
		),
		base_score=base_score,
		risk_disposition=risk_disposition,
	)

	report_id: str | None = None
	report_saved = False
	try:
		report_id = report_store.generate_report_id("email")
		report_payload = response.model_dump(mode="json")
		report_payload["organization_id"] = organization.id if organization else None
		report_payload["geolocation"] = {
			"source_ip": parsed.source_ip,
			"country": geo.country if geo else None,
			"region": geo.region if geo else None,
			"city": geo.city if geo else None,
			"asn": geo.asn if geo else None,
			"network_owner": geo.network_owner if geo else None,
			"is_vpn_proxy": geo.is_vpn_proxy if geo else None,
			"confidence": geo.confidence if geo else 0.0,
			"ip_status": "available" if parsed.source_ip else "unavailable",
			"origin_type": geo.origin_type if geo else "unknown_origin",
			"location_is_infrastructure": geo.location_is_infrastructure if geo else False,
			"location_note": location_note(geo, parsed.source_ip),
			**private_relay,
		}
		report = report_generator.build_email_report(report_payload, report_id)
		report["organization_id"] = organization.id if organization else None
		report_store.save_report(db, report)
		report_saved = True
		response.report_id = report_id
	except Exception:
		logger.exception("Failed to persist email report for message_id=%s", response.message_id)
		response.threat_advisory.ai_status = "not_scheduled"
		advisory.ai_status = "not_scheduled"
		advisory_json, advisory_csv = advisory_exports(advisory, base_score, parsed.message_id)
		response.threat_advisory.json_export = advisory_json
		response.threat_advisory.csv = advisory_csv

	if report_saved and report_id is not None:
		background_tasks.add_task(
			_generate_ai_explanation_for_report,
			report_id,
			advisory,
			base_score,
		)

	if base_score >= 20:
		try:
			await submit_fingerprint(
				FingerprintEvent(
					tenant_id=tenant_id,
					organization_id=organization.id if organization else None,
					message_id=response.message_id,
					sender=response.from_address,
					recipient=recipients[0] if recipients else None,
					subject=response.subject,
					body=response.fingerprint.redacted_body,
					fingerprint_hash=response.fingerprint.tlsh or response.fingerprint.body_sha256,
					fingerprint_type="TLSH" if response.fingerprint.tlsh else "SHA256",
					risk_score=base_score,
					source_ip=parsed.source_ip,
				),
				db,
			)
		except Exception:
			# A correlation outage must not reject a successfully scanned email.
			pass

	return response
