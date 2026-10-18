from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from email.utils import parseaddr

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .broadcaster import broadcaster
from .correlation import CORRELATION_WINDOW_MINUTES, TLSH_MAX_DISTANCE, correlate_fingerprint
from .database import get_db
from .geo import enrich_ip, location_note
from .models import (
    Dev2Campaign,
    Dev2CampaignCorrelation,
    Dev2CampaignMember,
    Dev2Email,
    Dev2Fingerprint,
)
from .schemas import (
    CampaignResponse,
    FingerprintEvent,
    HealthResponse,
    LiveFeedEvent,
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/developer2",
    tags=["Developer 2 - Central Correlation"],
)


# ============================================================
# UTC TIME
# ============================================================

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _sender_domain(sender: str | None) -> str | None:
    address = parseaddr(sender or "")[1]
    return address.rsplit("@", 1)[-1].lower() if "@" in address else None


def _within_correlation_window(first: datetime, second: datetime) -> bool:
    if first.tzinfo is None:
        first = first.replace(tzinfo=timezone.utc)
    if second.tzinfo is None:
        second = second.replace(tzinfo=timezone.utc)
    return abs(first - second) <= timedelta(minutes=CORRELATION_WINDOW_MINUTES)


def _campaign_members_payload(
    members: list[Dev2CampaignMember],
    organization_id: int | None = None,
) -> list[dict[str, Any]]:
    fingerprints = [member.fingerprint for member in members]
    fingerprints_by_id = {fingerprint.id: fingerprint for fingerprint in fingerprints}
    fingerprints_by_ip: dict[str, list[Dev2Fingerprint]] = {}
    fingerprints_by_domain: dict[str, list[Dev2Fingerprint]] = {}
    for fingerprint in fingerprints:
        if fingerprint.source_ip:
            fingerprints_by_ip.setdefault(fingerprint.source_ip, []).append(fingerprint)
        domain = _sender_domain(fingerprint.email.sender if fingerprint.email else None)
        if domain:
            fingerprints_by_domain.setdefault(domain, []).append(fingerprint)

    payload = []
    for member in members:
        fingerprint = member.fingerprint
        if organization_id is not None and fingerprint.organization_id != organization_id:
            continue
        domain = _sender_domain(fingerprint.email.sender if fingerprint.email else None)
        related_members: dict[int, set[str]] = {}
        for peer in fingerprints_by_ip.get(fingerprint.source_ip, []) if fingerprint.source_ip else []:
            if (
                peer.id != fingerprint.id
                and peer.tenant_id != fingerprint.tenant_id
                and _within_correlation_window(fingerprint.created_at, peer.created_at)
            ):
                related_members.setdefault(peer.id, set()).add("Shared source IP")
        for peer in fingerprints_by_domain.get(domain, []) if domain else []:
            if (
                peer.id != fingerprint.id
                and peer.tenant_id != fingerprint.tenant_id
                and _within_correlation_window(fingerprint.created_at, peer.created_at)
            ):
                related_members.setdefault(peer.id, set()).add("Shared sender domain")
        visible_related: list[dict[str, Any]] = []
        hidden_related_count = 0
        for peer_id, signals in related_members.items():
            peer = fingerprints_by_id[peer_id]
            if organization_id is not None and peer.organization_id != organization_id:
                hidden_related_count += 1
                continue
            visible_related.append({
                "fingerprint_id": peer_id,
                "signals": sorted(signals),
                "subject": peer.email.subject if peer.email else None,
                "observed_at": peer.created_at,
            })
        reasons = sorted({
            signal
            for relation in visible_related
            for signal in relation["signals"]
        })
        if hidden_related_count:
            reasons.append("Direct match exists with another organization's email")
        email = fingerprint.email
        payload.append({
            "fingerprint_id": member.fingerprint_id,
            "tenant_id": member.tenant_id,
            "similarity": member.similarity,
            "correlation_distance": member.correlation_distance,
            "fingerprint_type": fingerprint.fingerprint_type,
            "source_ip": fingerprint.source_ip,
            "sender_domain": domain,
            "subject": email.subject if email else None,
            "message_id": email.message_id if email else None,
            "risk_score": email.risk_score if email else None,
            "observed_at": fingerprint.created_at,
            "geo_country": fingerprint.geo_country,
            "match_reasons": reasons,
            "related_members": visible_related,
            "hidden_related_count": hidden_related_count,
        })
    return payload


def _campaign_correlations_payload(
    db: Session,
    campaign_id: int,
    members: list[Dev2CampaignMember],
    organization_id: int | None = None,
) -> tuple[list[dict[str, Any]], int]:
    visible_fingerprint_ids = {
        member.fingerprint_id
        for member in members
        if organization_id is None or member.fingerprint.organization_id == organization_id
    }
    correlations = list(db.execute(
        select(Dev2CampaignCorrelation)
        .where(Dev2CampaignCorrelation.campaign_id == campaign_id)
        .order_by(Dev2CampaignCorrelation.created_at.asc())
    ).scalars().all())

    visible_correlations = []
    hidden_count = 0
    for correlation in correlations:
        if (
            correlation.source_fingerprint_id not in visible_fingerprint_ids
            or correlation.matched_fingerprint_id not in visible_fingerprint_ids
        ):
            hidden_count += 1
            continue
        visible_correlations.append({
            "source_fingerprint_id": correlation.source_fingerprint_id,
            "matched_fingerprint_id": correlation.matched_fingerprint_id,
            "match_method": correlation.match_method,
            "similarity": correlation.similarity,
            "correlation_distance": correlation.correlation_distance,
            "matched_at": correlation.created_at,
        })
    return visible_correlations, hidden_count


# ============================================================
# HEALTH
# ============================================================

@router.get(
    "/health",
    response_model=HealthResponse,
)
def health_check() -> HealthResponse:

    return HealthResponse(
        status="healthy",
        service="developer2-central-correlation",
        timestamp=utc_now(),
    )


# ============================================================
# FINGERPRINT INGESTION
# ============================================================

@router.post(
    "/fingerprints",
)
async def submit_fingerprint(
    event: FingerprintEvent,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:

    received_at = (
        event.received_at
        or utc_now()
    )
    source_ip = getattr(event, "source_ip", None)
    supplied_country = getattr(event, "geo_country", None)
    supplied_region = getattr(event, "geo_region", None)
    supplied_city = getattr(event, "geo_city", None)
    supplied_asn = getattr(event, "geo_asn", None)
    supplied_vpn_proxy = getattr(event, "is_vpn_proxy", None)
    supplied_confidence = getattr(event, "geo_confidence", None)
    geo = await enrich_ip(source_ip)
    geo_country = supplied_country or (geo.country if geo else None)
    geo_region = supplied_region or (geo.region if geo else None)
    geo_city = supplied_city or (geo.city if geo else None)
    geo_asn = supplied_asn or (geo.asn if geo else None)
    is_vpn_proxy = supplied_vpn_proxy if supplied_vpn_proxy is not None else (geo.is_vpn_proxy if geo else None)
    geo_confidence = supplied_confidence if supplied_confidence is not None else (geo.confidence if geo else None)

    # --------------------------------------------------------
    # 1. Store normalized email
    # --------------------------------------------------------

    email = Dev2Email(
        organization_id=event.organization_id,
        tenant_id=event.tenant_id,
        message_id=event.message_id,
        sender=event.sender,
        recipient=event.recipient,
        subject=event.subject,
        body=event.body,
        received_at=received_at,
        risk_score=event.risk_score,
        status="RECEIVED",
        source_ip=source_ip or (geo.source_ip if geo else None),
        geo_country=geo_country,
        geo_region=geo_region,
        geo_city=geo_city,
        geo_asn=geo_asn,
        is_vpn_proxy=int(is_vpn_proxy) if is_vpn_proxy is not None else None,
        geo_confidence=geo_confidence,
    )

    db.add(email)

    try:

        db.flush()

    except SQLAlchemyError:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to store email",
        )

    # --------------------------------------------------------
    # 2. Store fingerprint
    # --------------------------------------------------------

    fingerprint = Dev2Fingerprint(
        organization_id=event.organization_id,
        email_id=email.id,
        tenant_id=event.tenant_id,
        fingerprint_hash=event.fingerprint_hash,
        fingerprint_type=event.fingerprint_type,
        created_at=received_at,
        source_ip=source_ip or (geo.source_ip if geo else None),
        geo_country=geo_country,
        geo_region=geo_region,
        geo_city=geo_city,
        geo_asn=geo_asn,
        is_vpn_proxy=int(is_vpn_proxy) if is_vpn_proxy is not None else None,
        geo_confidence=geo_confidence,
    )

    db.add(fingerprint)

    try:

        db.flush()

    except SQLAlchemyError:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to store fingerprint",
        )

    # --------------------------------------------------------
    # 3. Run correlation engine
    # --------------------------------------------------------

    try:

        campaign = correlate_fingerprint(
            db=db,
            fingerprint=fingerprint,
        )

        db.commit()

    except RuntimeError as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    except SQLAlchemyError:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Database error during correlation",
        )

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Correlation engine failed",
        )

    # --------------------------------------------------------
    # 4. Broadcast email event
    # --------------------------------------------------------

    email_event = LiveFeedEvent(
        event_type="EMAIL_SCANNED",
        timestamp=received_at,
        tenant_id=event.tenant_id,
        message_id=event.message_id,
        risk_score=event.risk_score,
        data={
            "email_id": email.id,
            "fingerprint_id": fingerprint.id,
            "fingerprint_type": (
                event.fingerprint_type
            ),
            "subject": event.subject,
            "geolocation": {
                "country": geo_country,
                "region": geo_region,
                "city": geo_city,
                "asn": geo_asn,
                "is_vpn_proxy": is_vpn_proxy,
                "confidence": geo_confidence,
                "network_owner": geo.network_owner if geo else None,
                "origin_type": geo.origin_type if geo else "unknown_origin",
                "location_is_infrastructure": geo.location_is_infrastructure if geo else False,
                "location_note": location_note(geo, source_ip),
            },
        },
    )

    await broadcaster.broadcast(
        email_event.model_dump(
            mode="json"
        )
    )

    # --------------------------------------------------------
    # 5. Broadcast campaign event
    # --------------------------------------------------------

    campaign_id = None

    if campaign is not None:

        campaign_id = (
            campaign.campaign_id
        )

        campaign_event = LiveFeedEvent(
            event_type="CAMPAIGN_CREATED"
            if campaign.created_at == campaign.last_seen
            else "CAMPAIGN_UPDATED",

            timestamp=utc_now(),

            tenant_id=event.tenant_id,

            message_id=event.message_id,

            campaign_id=campaign.campaign_id,

            risk_score=event.risk_score,

            data={
                "tenant_count": (
                    campaign.tenant_count
                ),

                "email_count": (
                    campaign.email_count
                ),

                "status": (
                    campaign.status
                ),
            },
        )

        await broadcaster.broadcast(
            campaign_event.model_dump(
                mode="json"
            )
        )

    # --------------------------------------------------------
    # 6. API response
    # --------------------------------------------------------

    return {
        "success": True,

        "email_id": email.id,

        "fingerprint_id": fingerprint.id,

        "campaign_created": (
            campaign is not None
        ),

        "campaign_id": campaign_id,
    }


# ============================================================
# GET ALL CAMPAIGNS
# ============================================================

@router.get(
    "/campaigns",
)
def get_campaigns(
    organization_id: int | None = None,
    db: Session = Depends(get_db),
):

    statement = (
        select(Dev2Campaign)
        .order_by(
            Dev2Campaign.last_seen.desc()
        )
    )
    if organization_id is not None:
        statement = statement.join(Dev2CampaignMember).join(Dev2Fingerprint).where(Dev2Fingerprint.organization_id == organization_id).distinct()

    campaigns = list(
        db.execute(statement)
        .scalars()
        .all()
    )

    response = []

    for campaign in campaigns:

        members_statement = (
            select(
                Dev2CampaignMember
            )
            .where(
                Dev2CampaignMember.campaign_id
                == campaign.id
            )
            .order_by(
                Dev2CampaignMember.similarity.desc()
            )
        )

        members = list(
            db.execute(
                members_statement
            )
            .scalars()
            .all()
        )

        organization_members = [
            member for member in members
            if organization_id is None or member.fingerprint.organization_id == organization_id
        ]
        scoped_members = _campaign_members_payload(members, organization_id)
        scoped_correlations, hidden_correlation_count = _campaign_correlations_payload(
            db,
            campaign.id,
            members,
            organization_id,
        )
        response.append(
            {
                "campaign_id": (
                    campaign.campaign_id
                ),

                "created_at": (
                    campaign.created_at
                ),

                "first_seen": (
                    campaign.first_seen
                ),

                "last_seen": (
                    campaign.last_seen
                ),

                "tenant_count": (
                    campaign.tenant_count
                    if organization_id is None
                    else len({member.tenant_id for member in organization_members})
                ),

                "email_count": (
                    campaign.email_count
                    if organization_id is None
                    else len(organization_members)
                ),

                "status": (
                    campaign.status
                ),

                "summary": (
                    campaign.summary
                    if organization_id is None
                    else "This organization has "
                    f"{len(organization_members)} correlated email(s). "
                    "Details for other organizations are hidden."
                ),

                "cross_organization_matches_hidden": (
                    organization_id is not None
                    and len(organization_members) < len(members)
                ),
                "correlation_window_minutes": CORRELATION_WINDOW_MINUTES,
                "tlsh_max_distance": TLSH_MAX_DISTANCE,
                "members": scoped_members,
                "correlations": scoped_correlations,
                "hidden_correlation_count": hidden_correlation_count,
                "historical_links_unavailable": (
                    not scoped_correlations
                    and hidden_correlation_count == 0
                    and len(members) > 1
                ),
            }
        )

    return response


# ============================================================
# GET SINGLE CAMPAIGN
# ============================================================

@router.get(
    "/campaigns/{campaign_id}",
)
def get_campaign(
    campaign_id: str,
    organization_id: int | None = None,
    db: Session = Depends(get_db),
):

    campaign_statement = (
        select(Dev2Campaign)
        .where(
            Dev2Campaign.campaign_id
            == campaign_id
        )
    )
    if organization_id is not None:
        campaign_statement = (
            campaign_statement
            .join(Dev2CampaignMember)
            .join(Dev2Fingerprint)
            .where(Dev2Fingerprint.organization_id == organization_id)
            .distinct()
        )

    campaign = (
        db.execute(
            campaign_statement
        )
        .scalars()
        .first()
    )

    if campaign is None:

        raise HTTPException(
            status_code=404,
            detail="Campaign not found",
        )

    members_statement = (
        select(
            Dev2CampaignMember
        )
        .where(
            Dev2CampaignMember.campaign_id
            == campaign.id
        )
        .order_by(
            Dev2CampaignMember.similarity.desc()
        )
    )

    members = list(
        db.execute(
            members_statement
        )
        .scalars()
        .all()
    )

    organization_members = [
        member for member in members
        if organization_id is None or member.fingerprint.organization_id == organization_id
    ]
    scoped_correlations, hidden_correlation_count = _campaign_correlations_payload(
        db,
        campaign.id,
        members,
        organization_id,
    )
    return {
        "campaign_id": (
            campaign.campaign_id
        ),

        "created_at": (
            campaign.created_at
        ),

        "first_seen": (
            campaign.first_seen
        ),

        "last_seen": (
            campaign.last_seen
        ),

        "tenant_count": (
            campaign.tenant_count
            if organization_id is None
            else len({member.tenant_id for member in organization_members})
        ),

        "email_count": (
            campaign.email_count
            if organization_id is None
            else len(organization_members)
        ),

        "status": (
            campaign.status
        ),

        "summary": (
            campaign.summary
            if organization_id is None
            else "This organization has "
            f"{len(organization_members)} correlated email(s). "
            "Details for other organizations are hidden."
        ),

        "cross_organization_matches_hidden": (
            organization_id is not None
            and len(organization_members) < len(members)
        ),
        "correlation_window_minutes": CORRELATION_WINDOW_MINUTES,
        "tlsh_max_distance": TLSH_MAX_DISTANCE,
        "members": _campaign_members_payload(members, organization_id),
        "correlations": scoped_correlations,
        "hidden_correlation_count": hidden_correlation_count,
        "historical_links_unavailable": (
            not scoped_correlations
            and hidden_correlation_count == 0
            and len(members) > 1
        ),
    }


# ============================================================
# WEBSOCKET LIVE FEED
# ============================================================

@router.websocket(
    "/ws/live-feed"
)
async def live_feed(
    websocket: WebSocket,
):

    await broadcaster.connect(
        websocket
    )

    try:

        # ----------------------------------------------------
        # Send initial connection event
        # ----------------------------------------------------

        connection_event = LiveFeedEvent(
            event_type="CONNECTED",
            timestamp=utc_now(),
            data={
                "service": (
                    "developer2-live-feed"
                ),

                "message": (
                    "SOC live feed connected"
                ),
            },
        )

        await websocket.send_json(
            connection_event.model_dump(
                mode="json"
            )
        )

        # ----------------------------------------------------
        # Keep connection alive
        # ----------------------------------------------------

        while True:

            await websocket.receive_text()

    except WebSocketDisconnect:

        await broadcaster.disconnect(
            websocket
        )

    except Exception:

        await broadcaster.disconnect(
            websocket
        )