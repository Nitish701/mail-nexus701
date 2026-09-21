from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Column, DateTime, Integer, String, Text, select
from sqlalchemy.orm import DeclarativeBase, Session

from app.developer2.database import engine


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


def delete_report(db: Session, report_id: str) -> bool:
	statement = select(ReportRecord).where(ReportRecord.report_id == report_id)
	record = db.execute(statement).scalars().first()
	if record is None:
		return False
	db.delete(record)
	db.commit()
	return True