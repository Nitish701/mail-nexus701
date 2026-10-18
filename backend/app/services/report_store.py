from __future__ import annotations

import json
import uuid
from datetime import datetime, time, timezone
from typing import Any

from sqlalchemy import Column, DateTime, Integer, String, Text, case, func, select
from sqlalchemy.orm import DeclarativeBase, Session

from app.developer2.database import engine
from app.developer2.models import Dev2Campaign, Dev2CampaignMember, Dev2Fingerprint


class ReportBase(DeclarativeBase):
	pass


class ReportRecord(ReportBase):
	__tablename__ = "mail_nexus_reports"

	id = Column(Integer, primary_key=True, autoincrement=True)
	organization_id = Column(Integer, nullable=True, index=True)
	report_id = Column(String(80), nullable=False, unique=True, index=True)
	report_type = Column(String(32), nullable=False, index=True)
	severity = Column(String(16), nullable=False, index=True)
	title = Column(String(500), nullable=False)
	message_id = Column(String(255), nullable=True, index=True)
	campaign_id = Column(String(128), nullable=True, index=True)
	payload = Column(Text, nullable=False)
	created_at = Column(
		DateTime(timezone=True),
		nullable=False,
		default=lambda: datetime.now(timezone.utc),
		index=True,
	)


ReportBase.metadata.create_all(bind=engine)


def generate_report_id(report_type: str) -> str:
	prefix = "RPT-CMP" if report_type == "campaign" else "RPT-EML"
	timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
	return f"{prefix}-{timestamp}-{uuid.uuid4().hex[:8].upper()}"


def save_report(db: Session, report: dict[str, Any]) -> ReportRecord:
	message = report.get("message") or {}
	campaign = report.get("campaign") or {}
	record = ReportRecord(
		report_id=str(report["report_id"]),
		organization_id=report.get("organization_id"),
		report_type=str(report.get("report_type") or "email"),
		severity=str(report.get("severity") or "low"),
		title=str(report.get("title") or "Threat Report"),
		message_id=message.get("message_id"),
		campaign_id=campaign.get("campaign_id"),
		payload=json.dumps(report, default=str),
	)
	db.add(record)
	db.commit()
	db.refresh(record)
	return record


def _to_summary(record: ReportRecord) -> dict[str, Any]:
	return {
		"report_id": record.report_id,
		"report_type": record.report_type,
		"severity": record.severity,
		"title": record.title,
		"message_id": record.message_id,
		"campaign_id": record.campaign_id,
		"created_at": record.created_at,
	}


def list_reports(db: Session, report_type: str | None = None, organization_id: int | None = None, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
	statement = select(ReportRecord).order_by(ReportRecord.created_at.desc())
	if report_type:
		statement = statement.where(ReportRecord.report_type == report_type)
	if organization_id is not None:
		statement = statement.where(ReportRecord.organization_id == organization_id)
	statement = statement.limit(max(1, min(limit, 200))).offset(max(0, offset))
	records = db.execute(statement).scalars().all()
	return [_to_summary(record) for record in records]


def get_dashboard_summary(db: Session, organization_id: int | None = None, recent_limit: int = 8) -> dict[str, Any]:
	local_now = datetime.now().astimezone()
	today_start = datetime.combine(local_now.date(), time.min, tzinfo=local_now.tzinfo).astimezone(timezone.utc)
	base_filters = [ReportRecord.report_type == "email"]
	if organization_id is not None:
		base_filters.append(ReportRecord.organization_id == organization_id)

	counts = db.execute(
		select(
			func.count(ReportRecord.id),
			func.sum(case((ReportRecord.created_at >= today_start, 1), else_=0)),
			func.sum(case((ReportRecord.severity.in_(("review", "medium")), 1), else_=0)),
			func.sum(case((ReportRecord.severity.in_(("high", "critical")), 1), else_=0)),
		).where(*base_filters)
	).one()
	suspicious_filters = [
		*base_filters,
		ReportRecord.severity.in_(("review", "medium", "high", "critical")),
	]
	recent_records = db.execute(
		select(ReportRecord)
		.where(*suspicious_filters)
		.order_by(ReportRecord.created_at.desc())
		.limit(max(1, min(recent_limit, 20)))
	).scalars().all()

	recent_emails: list[dict[str, Any]] = []
	for record in recent_records:
		try:
			report = json.loads(record.payload)
		except (TypeError, ValueError) as error:
			raise ValueError(f"Stored report {record.report_id} contains invalid JSON") from error
		message = report.get("message") if isinstance(report, dict) else {}
		message = message if isinstance(message, dict) else {}
		recent_emails.append({
			**_to_summary(record),
			"sender": message.get("from"),
			"subject": message.get("subject"),
		})

	campaign_filters = [Dev2Campaign.status == "ACTIVE"]
	campaign_statement = select(Dev2Campaign).where(*campaign_filters)
	campaign_count_statement = select(func.count(Dev2Campaign.id)).where(*campaign_filters)
	if organization_id is not None:
		campaign_filters.append(Dev2Fingerprint.organization_id == organization_id)
		campaign_statement = (
			select(Dev2Campaign)
			.join(Dev2CampaignMember, Dev2CampaignMember.campaign_id == Dev2Campaign.id)
			.join(Dev2Fingerprint, Dev2Fingerprint.id == Dev2CampaignMember.fingerprint_id)
			.where(*campaign_filters)
			.distinct()
		)
		campaign_count_statement = (
			select(func.count(func.distinct(Dev2Campaign.id)))
			.select_from(Dev2Campaign)
			.join(Dev2CampaignMember, Dev2CampaignMember.campaign_id == Dev2Campaign.id)
			.join(Dev2Fingerprint, Dev2Fingerprint.id == Dev2CampaignMember.fingerprint_id)
			.where(*campaign_filters)
		)
	campaign_count = db.execute(campaign_count_statement).scalar_one()
	campaign_records = db.execute(
		campaign_statement.order_by(Dev2Campaign.last_seen.desc()).limit(3)
	).scalars().all()

	return {
		"emails_today": int(counts[1] or 0),
		"day_timezone": local_now.tzname() or "local time",
		"needs_review": int(counts[2] or 0),
		"high_risk": int(counts[3] or 0),
		"recent_suspicious_emails": recent_emails,
		"active_campaign_count": int(campaign_count or 0),
		"active_campaigns": [
			{
				"campaign_id": campaign.campaign_id,
				"summary": campaign.summary,
				"email_count": campaign.email_count,
				"last_seen": campaign.last_seen,
			}
			for campaign in campaign_records
		],
	}


def get_report(db: Session, report_id: str, organization_id: int | None = None) -> dict[str, Any] | None:
	statement = select(ReportRecord).where(ReportRecord.report_id == report_id)
	if organization_id is not None:
		statement = statement.where(ReportRecord.organization_id == organization_id)
	record = db.execute(statement).scalars().first()
	if record is None:
		return None
	try:
		report = json.loads(record.payload)
	except (TypeError, ValueError):
		report = {"report_id": record.report_id, "report_type": record.report_type, "title": record.title}
	report["_stored_at"] = record.created_at
	return report


def update_report_advisory(db: Session, report_id: str, advisory: dict[str, Any]) -> bool:
	record = db.execute(
		select(ReportRecord).where(ReportRecord.report_id == report_id)
	).scalars().first()
	if record is None:
		return False
	try:
		report = json.loads(record.payload)
	except (TypeError, ValueError) as error:
		raise ValueError(f"Stored report {report_id} contains invalid JSON") from error
	if not isinstance(report, dict) or not isinstance(report.get("advisory"), dict):
		raise ValueError(f"Stored report {report_id} has no advisory object")
	report["advisory"].update(advisory)
	record.payload = json.dumps(report, default=str)
	db.commit()
	return True


def delete_report(db: Session, report_id: str) -> bool:
	statement = select(ReportRecord).where(ReportRecord.report_id == report_id)
	record = db.execute(statement).scalars().first()
	if record is None:
		return False
	db.delete(record)
	db.commit()
	return True