from datetime import datetime, timezone
from typing import Any, Dict

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
from .correlation import correlate_fingerprint
from .database import get_db
from .geo import enrich_ip
from .models import (
    Dev2Campaign,
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
                ),

                "email_count": (
                    campaign.email_count
                ),

                "status": (
                    campaign.status
                ),

                "summary": (
                    campaign.summary
                ),

                "members": [
                    {
                        "fingerprint_id": (
                            member.fingerprint_id
                        ),

                        "tenant_id": (
                            member.tenant_id
                        ),

                        "similarity": (
                            member.similarity
                        ),

                        "correlation_distance": (
                            member.correlation_distance
                        ),
                    }
                    for member in members
                ],
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
    db: Session = Depends(get_db),
):

    campaign_statement = (
        select(Dev2Campaign)
        .where(
            Dev2Campaign.campaign_id
            == campaign_id
        )
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
        ),

        "email_count": (
            campaign.email_count
        ),

        "status": (
            campaign.status
        ),

        "summary": (
            campaign.summary
        ),

        "members": [
            {
                "fingerprint_id": (
                    member.fingerprint_id
                ),

                "tenant_id": (
                    member.tenant_id
                ),

                "similarity": (
                    member.similarity
                ),

                "correlation_distance": (
                    member.correlation_distance
                ),
            }
            for member in members
        ],
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