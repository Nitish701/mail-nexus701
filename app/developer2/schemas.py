from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# EMAIL / FINGERPRINT INGESTION
# ============================================================

class FingerprintEvent(BaseModel):
    """
    Payload received by the Central Correlation Engine
    from a tenant/college gateway.
    """

    model_config = ConfigDict(
        extra="ignore"
    )

    tenant_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Unique tenant/college identifier",
        examples=["IITB"],
    )

    message_id: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    sender: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    recipient: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    subject: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    body: Optional[str] = Field(
        default=None,
    )

    fingerprint_hash: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="TLSH or other supported fingerprint",
    )

    fingerprint_type: str = Field(
        default="TLSH",
        min_length=1,
        max_length=50,
    )

    received_at: Optional[datetime] = None

    risk_score: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
    )


# ============================================================
# CAMPAIGN MEMBER
# ============================================================

class CampaignMemberResponse(BaseModel):
    """
    A fingerprint/tenant participating in a campaign.
    """

    model_config = ConfigDict(
        from_attributes=True
    )

    fingerprint_id: int

    tenant_id: str

    similarity: Optional[float] = None

    correlation_distance: Optional[int] = None


# ============================================================
# CAMPAIGN RESPONSE
# ============================================================

class CampaignResponse(BaseModel):
    """
    Campaign returned to the SOC dashboard.
    """

    model_config = ConfigDict(
        from_attributes=True
    )

    campaign_id: str

    created_at: datetime

    first_seen: datetime

    last_seen: datetime

    tenant_count: int

    email_count: int

    status: str

    summary: Optional[str] = None

    members: List[
        CampaignMemberResponse
    ] = []


# ============================================================
# LIVE WEBSOCKET EVENT
# ============================================================

class LiveFeedEvent(BaseModel):
    """
    Standard event format sent to the frontend
    through the WebSocket.
    """

    event_type: str = Field(
        ...,
        description=(
            "EMAIL_SCANNED, "
            "CAMPAIGN_CREATED, "
            "CAMPAIGN_UPDATED"
        ),
    )

    timestamp: datetime

    tenant_id: Optional[str] = None

    message_id: Optional[str] = None

    campaign_id: Optional[str] = None

    risk_score: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
    )

    data: Dict[str, Any] = Field(
        default_factory=dict
    )


# ============================================================
# API STATUS
# ============================================================

class HealthResponse(BaseModel):

    status: str

    service: str

    timestamp: datetime


# ============================================================
# CORRELATION RESULT
# ============================================================

class CorrelationResult(BaseModel):
    """
    Internal/result representation of a correlation operation.
    """

    matched: bool

    campaign_id: Optional[str] = None

    similarity: Optional[float] = None

    correlation_distance: Optional[int] = None

    matched_tenants: List[str] = Field(
        default_factory=list
    )

    matched_fingerprints: List[int] = Field(
        default_factory=list
    )from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# EMAIL / FINGERPRINT INGESTION
# ============================================================

class FingerprintEvent(BaseModel):
    """
    Payload received by the Central Correlation Engine
    from a tenant/college gateway.
    """

    model_config = ConfigDict(
        extra="ignore"
    )

    tenant_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Unique tenant/college identifier",
        examples=["IITB"],
    )

    message_id: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    sender: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    recipient: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    subject: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    body: Optional[str] = Field(
        default=None,
    )

    fingerprint_hash: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="TLSH or other supported fingerprint",
    )

    fingerprint_type: str = Field(
        default="TLSH",
        min_length=1,
        max_length=50,
    )

    received_at: Optional[datetime] = None

    risk_score: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
    )


# ============================================================
# CAMPAIGN MEMBER
# ============================================================

class CampaignMemberResponse(BaseModel):
    """
    A fingerprint/tenant participating in a campaign.
    """

    model_config = ConfigDict(
        from_attributes=True
    )

    fingerprint_id: int

    tenant_id: str

    similarity: Optional[float] = None

    correlation_distance: Optional[int] = None


# ============================================================
# CAMPAIGN RESPONSE
# ============================================================

class CampaignResponse(BaseModel):
    """
    Campaign returned to the SOC dashboard.
    """

    model_config = ConfigDict(
        from_attributes=True
    )

    campaign_id: str

    created_at: datetime

    first_seen: datetime

    last_seen: datetime

    tenant_count: int

    email_count: int

    status: str

    summary: Optional[str] = None

    members: List[
        CampaignMemberResponse
    ] = []


# ============================================================
# LIVE WEBSOCKET EVENT
# ============================================================

class LiveFeedEvent(BaseModel):
    """
    Standard event format sent to the frontend
    through the WebSocket.
    """

    event_type: str = Field(
        ...,
        description=(
            "EMAIL_SCANNED, "
            "CAMPAIGN_CREATED, "
            "CAMPAIGN_UPDATED"
        ),
    )

    timestamp: datetime

    tenant_id: Optional[str] = None

    message_id: Optional[str] = None

    campaign_id: Optional[str] = None

    risk_score: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
    )

    data: Dict[str, Any] = Field(
        default_factory=dict
    )


# ============================================================
# API STATUS
# ============================================================

class HealthResponse(BaseModel):

    status: str

    service: str

    timestamp: datetime


# ============================================================
# CORRELATION RESULT
# ============================================================

class CorrelationResult(BaseModel):
    """
    Internal/result representation of a correlation operation.
    """

    matched: bool

    campaign_id: Optional[str] = None

    similarity: Optional[float] = None

    correlation_distance: Optional[int] = None

    matched_tenants: List[str] = Field(
        default_factory=list
    )

    matched_fingerprints: List[int] = Field(
        default_factory=list
    )