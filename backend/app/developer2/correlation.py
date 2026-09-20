from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    Dev2Campaign,
    Dev2CampaignMember,
    Dev2Fingerprint,
)
from .geo import geo_match


# ============================================================
# CONFIGURATION
# ============================================================

CORRELATION_WINDOW_MINUTES = 60

# Lower TLSH distance = more similar.
#
# This is deliberately configurable rather than hard-coded
# throughout the engine.
TLSH_MAX_DISTANCE = 100

# Minimum number of different tenants required to create
# a campaign.
MIN_CAMPAIGN_TENANTS = 2


# ============================================================
# UTC TIME
# ============================================================

def utc_now() -> datetime:
    """
    Return timezone-aware UTC time.
    """

    return datetime.now(timezone.utc)


# ============================================================
# TLSH
# ============================================================

def _load_tlsh():
    """
    Load TLSH lazily.

    This prevents the entire Developer-2 application from
    failing during import if TLSH has not been installed yet.
    """

    try:
        import tlsh

        return tlsh

    except ImportError:

        return None


def calculate_tlsh_difference(
    fingerprint_a: str,
    fingerprint_b: str,
) -> Optional[int]:
    """
    Calculate TLSH distance between two fingerprints.

    Returns:
        0       -> identical fingerprints
        >0      -> distance between fingerprints
        None    -> unable to calculate

    The function supports the common TLSH API:

        tlsh.diff(hash_a, hash_b)
    """

    if not fingerprint_a or not fingerprint_b:
        return None

    if fingerprint_a == fingerprint_b:
        return 0

    tlsh = _load_tlsh()

    if tlsh is None:
        raise RuntimeError(
            "TLSH library is not installed. "
            "Install it with: pip install py-tlsh"
        )

    try:

        distance = tlsh.diff(
            fingerprint_a,
            fingerprint_b,
        )

        return int(distance)

    except Exception:
        return None


# ============================================================
# TLSH SIMILARITY
# ============================================================

def calculate_similarity(
    distance: int,
    maximum_distance: int = TLSH_MAX_DISTANCE,
) -> float:
    """
    Convert TLSH distance into a normalized similarity value.

    Returns a value between 0.0 and 1.0.

    1.0 = identical
    0.0 = outside configured threshold
    """

    if distance <= 0:
        return 1.0

    if maximum_distance <= 0:
        return 0.0

    if distance >= maximum_distance:
        return 0.0

    similarity = (
        1.0
        - (
            distance
            / maximum_distance
        )
    )

    return round(
        max(0.0, min(1.0, similarity)),
        4,
    )


# ============================================================
# CAMPAIGN ID
# ============================================================

def generate_campaign_id() -> str:
    """
    Generate a globally unique campaign identifier.

    Example:

        CMP-20260920-142355-A81F2D91
    """

    timestamp = utc_now().strftime(
        "%Y%m%d-%H%M%S"
    )

    random_part = uuid.uuid4().hex[:8].upper()

    return (
        f"CMP-{timestamp}-{random_part}"
    )


# ============================================================
# SLIDING WINDOW
# ============================================================

def get_window_start(
    timestamp: datetime,
) -> datetime:
    """
    Return the beginning of the 60-minute
    sliding correlation window.
    """

    return (
        timestamp
        - timedelta(
            minutes=CORRELATION_WINDOW_MINUTES
        )
    )


# ============================================================
# FIND CANDIDATES
# ============================================================

def find_window_candidates(
    db: Session,
    fingerprint: Dev2Fingerprint,
) -> List[Dev2Fingerprint]:
    """
    Find fingerprints received during the configured
    sliding window.

    IMPORTANT:
    The current tenant is excluded.

    Campaigns require evidence from different tenants.
    """

    current_time = (
        fingerprint.created_at
        or utc_now()
    )

    window_start = get_window_start(
        current_time
    )

    statement = (
        select(Dev2Fingerprint)
        .where(
            Dev2Fingerprint.created_at
            >= window_start,

            Dev2Fingerprint.created_at
            <= current_time,

            Dev2Fingerprint.id
            != fingerprint.id,

            Dev2Fingerprint.tenant_id
            != fingerprint.tenant_id,
        )
        .order_by(
            Dev2Fingerprint.created_at.asc()
        )
    )

    return list(
        db.execute(statement)
        .scalars()
        .all()
    )


# ============================================================
# COMPARE FINGERPRINTS
# ============================================================

def compare_fingerprint(
    current: Dev2Fingerprint,
    candidate: Dev2Fingerprint,
) -> Optional[Dict]:
    """
    Compare two fingerprints.

    Returns a match dictionary only if the TLSH distance
    falls within the configured threshold.
    """

    distance = calculate_tlsh_difference(
        current.fingerprint_hash,
        candidate.fingerprint_hash,
    )

    if distance is None:
        return None

    if distance > TLSH_MAX_DISTANCE:
        return None

    similarity = calculate_similarity(
        distance
    )
    location_match, location_bonus = geo_match(current, candidate)

    return {
        "fingerprint": candidate,
        "distance": distance,
        "similarity": round(min(1.0, similarity + location_bonus), 4),
        "geo_match": location_match,
        "geo_bonus": location_bonus,
    }


# ============================================================
# CORRELATE
# ============================================================

def find_matches(
    db: Session,
    fingerprint: Dev2Fingerprint,
) -> List[Dict]:
    """
    Find all matching fingerprints from other tenants
    inside the 60-minute window.
    """

    candidates = find_window_candidates(
        db,
        fingerprint,
    )

    matches: List[Dict] = []

    for candidate in candidates:

        result = compare_fingerprint(
            fingerprint,
            candidate,
        )

        if result is not None:

            matches.append(
                result
            )

    return matches


# ============================================================
# TENANT EXTRACTION
# ============================================================

def collect_tenants(
    fingerprint: Dev2Fingerprint,
    matches: List[Dict],
) -> Set[str]:
    """
    Return the unique tenants involved in a correlation.
    """

    tenants: Set[str] = {
        fingerprint.tenant_id
    }

    for match in matches:

        candidate = match["fingerprint"]

        tenants.add(
            candidate.tenant_id
        )

    return tenants


# ============================================================
# EXISTING CAMPAIGN LOOKUP
# ============================================================

def find_existing_campaign(
    db: Session,
    fingerprint: Dev2Fingerprint,
    matches: List[Dict],
) -> Optional[Dev2Campaign]:
    """
    Check whether any of the fingerprints involved in this
    correlation already belongs to a campaign.

    This prevents the system from creating a new campaign
    every time another related email arrives.
    """

    fingerprint_ids = {
        fingerprint.id
    }

    for match in matches:

        fingerprint_ids.add(
            match["fingerprint"].id
        )

    if not fingerprint_ids:
        return None

    statement = (
        select(Dev2Campaign)
        .join(
            Dev2CampaignMember,
            Dev2Campaign.id
            == Dev2CampaignMember.campaign_id,
        )
        .where(
            Dev2CampaignMember.fingerprint_id.in_(
                fingerprint_ids
            )
        )
        .order_by(
            Dev2Campaign.last_seen.desc()
        )
    )

    return (
        db.execute(statement)
        .scalars()
        .first()
    )


# ============================================================
# ADD CAMPAIGN MEMBER
# ============================================================

def add_campaign_member(
    db: Session,
    campaign: Dev2Campaign,
    fingerprint: Dev2Fingerprint,
    similarity: Optional[float],
    distance: Optional[int],
) -> bool:
    """
    Add a fingerprint to a campaign.

    Returns:
        True  -> member was created
        False -> member already existed
    """

    statement = (
        select(Dev2CampaignMember)
        .where(
            Dev2CampaignMember.campaign_id
            == campaign.id,

            Dev2CampaignMember.fingerprint_id
            == fingerprint.id,
        )
    )

    existing = (
        db.execute(statement)
        .scalars()
        .first()
    )

    if existing is not None:

        # Update correlation information if the new
        # observation gives us a stronger similarity.
        if (
            similarity is not None
            and (
                existing.similarity is None
                or similarity > existing.similarity
            )
        ):
            existing.similarity = similarity

            existing.correlation_distance = (
                distance
            )

        return False

    member = Dev2CampaignMember(
        campaign_id=campaign.id,
        fingerprint_id=fingerprint.id,
        tenant_id=fingerprint.tenant_id,
        similarity=similarity,
        correlation_distance=distance,
    )

    db.add(member)

    return True


# ============================================================
# UPDATE CAMPAIGN COUNTS
# ============================================================

def build_campaign_summary(
    campaign: Dev2Campaign,
    members: List[Dev2CampaignMember],
) -> str:
    """
    Produce a concise human-readable summary of a campaign.

    Stored on the campaign so SOC dashboards and generated
    reports have a description without recomputing it.
    """

    tenants = sorted({
        member.tenant_id
        for member in members
        if member.tenant_id
    })

    similarities = [
        member.similarity
        for member in members
        if member.similarity is not None
    ]

    average_similarity = (
        round(sum(similarities) / len(similarities), 4)
        if similarities
        else None
    )

    tenant_text = (
        ", ".join(tenants)
        if tenants
        else "no tenants"
    )

    window = CORRELATION_WINDOW_MINUTES

    return (
        f"Correlated campaign spanning {len(tenants)} tenant(s) "
        f"({tenant_text}) and {len(members)} email fingerprint(s) "
        f"within a {window}-minute window. "
        f"Average similarity "
        f"{average_similarity if average_similarity is not None else 'n/a'}."
    )


def update_campaign_counts(
    db: Session,
    campaign: Dev2Campaign,
) -> None:
    """
    Recalculate campaign statistics from actual members.

    This avoids relying on manually incremented counters,
    which can become incorrect after repeated correlation.
    """

    statement = (
        select(Dev2CampaignMember)
        .where(
            Dev2CampaignMember.campaign_id
            == campaign.id
        )
    )

    members = list(
        db.execute(statement)
        .scalars()
        .all()
    )

    unique_tenants = {
        member.tenant_id
        for member in members
    }

    campaign.tenant_count = len(
        unique_tenants
    )

    campaign.email_count = len(
        members
    )

    campaign.summary = build_campaign_summary(
        campaign,
        members,
    )


# ============================================================
# CREATE / UPDATE CAMPAIGN
# ============================================================

def create_or_update_campaign(
    db: Session,
    fingerprint: Dev2Fingerprint,
    matches: List[Dict],
) -> Optional[Dev2Campaign]:
    """
    Create a new campaign or update an existing campaign.

    A campaign is created only when at least two distinct
    tenants participate in the correlation.
    """

    if not matches:
        return None

    tenants = collect_tenants(
        fingerprint,
        matches,
    )

    # --------------------------------------------------------
    # SIH REQUIREMENT:
    # Campaign requires >= 2 tenants.
    # --------------------------------------------------------

    if len(tenants) < MIN_CAMPAIGN_TENANTS:
        return None

    now = (
        fingerprint.created_at
        or utc_now()
    )

    campaign = find_existing_campaign(
        db,
        fingerprint,
        matches,
    )

    # --------------------------------------------------------
    # CREATE NEW CAMPAIGN
    # --------------------------------------------------------

    if campaign is None:

        campaign = Dev2Campaign(
            campaign_id=generate_campaign_id(),
            created_at=now,
            first_seen=now,
            last_seen=now,
            tenant_count=0,
            email_count=0,
            status="ACTIVE",
        )

        db.add(campaign)

        # We need the database-generated campaign ID
        # before creating campaign members.
        db.flush()

    # --------------------------------------------------------
    # UPDATE EXISTING CAMPAIGN
    # --------------------------------------------------------

    else:

        if (
            campaign.first_seen is None
            or now < campaign.first_seen
        ):
            campaign.first_seen = now

        if (
            campaign.last_seen is None
            or now > campaign.last_seen
        ):
            campaign.last_seen = now

        if campaign.status != "ACTIVE":
            campaign.status = "ACTIVE"

    # --------------------------------------------------------
    # ADD CURRENT FINGERPRINT
    # --------------------------------------------------------

    add_campaign_member(
        db=db,
        campaign=campaign,
        fingerprint=fingerprint,
        similarity=1.0,
        distance=0,
    )

    # --------------------------------------------------------
    # ADD MATCHED FINGERPRINTS
    # --------------------------------------------------------

    for match in matches:

        candidate = match["fingerprint"]

        add_campaign_member(
            db=db,
            campaign=campaign,
            fingerprint=candidate,
            similarity=match["similarity"],
            distance=match["distance"],
        )

    # --------------------------------------------------------
    # RECALCULATE STATISTICS
    # --------------------------------------------------------

    update_campaign_counts(
        db,
        campaign,
    )

    db.flush()

    return campaign


# ============================================================
# MAIN CORRELATION FUNCTION
# ============================================================

def correlate_fingerprint(
    db: Session,
    fingerprint: Dev2Fingerprint,
) -> Optional[Dev2Campaign]:
    """
    Main entry point used by the Developer-2 router.

    Flow:

        fingerprint
             ↓
        60-minute window
             ↓
        exclude same tenant
             ↓
        TLSH comparison
             ↓
        threshold filtering
             ↓
        unique tenant check
             ↓
        create/update campaign
    """

    matches = find_matches(
        db,
        fingerprint,
    )

    if not matches:
        return None

    return create_or_update_campaign(
        db=db,
        fingerprint=fingerprint,
        matches=matches,
    )