from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.developer2.database import get_db
from app.developer2.models import Dev2Campaign, Dev2CampaignMember
from app.services import report_generator, report_store


router = APIRouter(prefix="/api/reports", tags=["Reports"])


_FORMATS = {
	"json": ("application/json", "json"),
	"csv": ("text/csv", "csv"),
	"md": ("text/markdown", "md"),
	"markdown": ("text/markdown", "md"),
	"html": ("text/html", "html"),
}


def _render(report: dict, fmt: str) -> str:
	if fmt == "json":
		return report_generator.render_json(report)
	if fmt == "csv":
		return report_generator.render_csv(report)
	if fmt == "md":
		return report_generator.render_markdown(report)
	if fmt == "html":
		return report_generator.render_html(report)
	raise HTTPException(status_code=400, detail="Unsupported format")


@router.get("")
def list_reports(
	report_type: str | None = Query(default=None, pattern="^(email|campaign)$"),
	suspicious_only: bool = Query(default=False),
	organization_id: int | None = Query(default=None, ge=1),
	limit: int = Query(default=50, ge=1, le=200),
	offset: int = Query(default=0, ge=0),
	db: Session = Depends(get_db),
):
	reports = report_store.list_reports(db, report_type=report_type, organization_id=organization_id, limit=limit, offset=offset)
	if suspicious_only:
		filtered: list[dict] = []
		for report in reports:
			if report.get("report_type") != "email":
				continue
			detail = report_store.get_report(db, report["report_id"]) or {}
			risk = detail.get("risk") or {}
			if int(risk.get("base_score") or 0) >= 20:
				filtered.append(report)
		reports = filtered
	return {"reports": reports}


@router.get("/{report_id}")
def get_report(report_id: str, organization_id: int | None = Query(default=None, ge=1), db: Session = Depends(get_db)):
	report = report_store.get_report(db, report_id, organization_id=organization_id)
	if report is None:
		raise HTTPException(status_code=404, detail="Report not found")
	return report


@router.get("/{report_id}/download")
def download_report(
	report_id: str,
	format: str = Query(default="json"),
	db: Session = Depends(get_db),
):
	fmt = format.lower()
	if fmt not in _FORMATS:
		raise HTTPException(status_code=400, detail="format must be one of json, csv, md, html")
	report = report_store.get_report(db, report_id)
	if report is None:
		raise HTTPException(status_code=404, detail="Report not found")
	media_type, extension = _FORMATS[fmt]
	body = _render(report, extension)
	filename = f"{report_id}.{extension}"
	return Response(
		content=body,
		media_type=media_type,
		headers={"Content-Disposition": f'attachment; filename="{filename}"'},
	)


@router.post("/campaign/{campaign_id}")
def create_campaign_report(campaign_id: str, db: Session = Depends(get_db)):
	report = _campaign_payload(db, campaign_id)
	if report is None:
		raise HTTPException(status_code=404, detail="Campaign not found")
	record = report_store.save_report(db, report)
	result = {"report_id": record.report_id, "report_type": "campaign", "severity": report.get("severity")}
	return result


@router.delete("/{report_id}")
def delete_report(report_id: str, db: Session = Depends(get_db)):
	if not report_store.delete_report(db, report_id):
		raise HTTPException(status_code=404, detail="Report not found")
	return {"deleted": True, "report_id": report_id}


def _campaign_payload(db: Session, campaign_id: str) -> dict | None:
	campaign = db.execute(
		select(Dev2Campaign).where(Dev2Campaign.campaign_id == campaign_id)
	).scalars().first()
	if campaign is None:
		return None
	members = db.execute(
		select(Dev2CampaignMember)
		.where(Dev2CampaignMember.campaign_id == campaign.id)
		.order_by(Dev2CampaignMember.similarity.desc())
	).scalars().all()
	payload = {
		"campaign_id": campaign.campaign_id,
		"status": campaign.status,
		"created_at": campaign.created_at,
		"first_seen": campaign.first_seen,
		"last_seen": campaign.last_seen,
		"tenant_count": campaign.tenant_count,
		"email_count": campaign.email_count,
		"summary": campaign.summary,
		"members": [
			{
				"fingerprint_id": member.fingerprint_id,
				"tenant_id": member.tenant_id,
				"similarity": member.similarity,
				"correlation_distance": member.correlation_distance,
			}
			for member in members
		],
	}
	report_id = report_store.generate_report_id("campaign")
	return report_generator.build_campaign_report(payload, report_id)
