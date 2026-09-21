from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from sqlalchemy.orm import relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    domains = relationship("OrganizationDomain", back_populates="organization", cascade="all, delete-orphan")


class OrganizationDomain(Base):
    __tablename__ = "organization_domains"

    id = Column(Integer, primary_key=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    domain = Column(String(253), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    organization = relationship("Organization", back_populates="domains")


# ============================================================
# EMAIL
# ============================================================

class Dev2Email(Base):
    """
    Stores normalized email metadata received from a tenant.

    One Email has one Fingerprint.
    """

    __tablename__ = "dev2_emails"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)

    tenant_id = Column(
        String(100),
        nullable=False,
        index=True,
    )

    message_id = Column(
        String(255),
        nullable=True,
        index=True,
    )

    sender = Column(
        String(500),
        nullable=True,
    )

    recipient = Column(
        String(500),
        nullable=True,
    )

    subject = Column(
        Text,
        nullable=True,
    )

    body = Column(
        Text,
        nullable=True,
    )

    received_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )

    risk_score = Column(
        Float,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="NEW",
        index=True,
    )

    source_ip = Column(String(45), nullable=True, index=True)
    geo_country = Column(String(100), nullable=True)
    geo_region = Column(String(150), nullable=True)
    geo_city = Column(String(150), nullable=True)
    geo_asn = Column(String(32), nullable=True)
    is_vpn_proxy = Column(Integer, nullable=True)
    geo_confidence = Column(Float, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    # --------------------------------------------------------
    # Relationship
    # --------------------------------------------------------

    fingerprint = relationship(
        "Dev2Fingerprint",
        back_populates="email",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # --------------------------------------------------------
    # Composite indexes
    # --------------------------------------------------------

    __table_args__ = (
        Index(
            "ix_dev2_email_tenant_received",
            "tenant_id",
            "received_at",
        ),
    )


# ============================================================
# FINGERPRINT
# ============================================================

class Dev2Fingerprint(Base):
    """
    Stores the normalized fingerprint generated from an email.

    The fingerprint is the object used by the correlation engine.
    """

    __tablename__ = "dev2_fingerprints"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)

    email_id = Column(
        Integer,
        ForeignKey(
            "dev2_emails.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
    )

    tenant_id = Column(
        String(100),
        nullable=False,
        index=True,
    )

    fingerprint_hash = Column(
        String(500),
        nullable=False,
        index=True,
    )

    fingerprint_type = Column(
        String(50),
        nullable=False,
        default="TLSH",
    )

    source_ip = Column(String(45), nullable=True, index=True)
    geo_country = Column(String(100), nullable=True)
    geo_region = Column(String(150), nullable=True)
    geo_city = Column(String(150), nullable=True)
    geo_asn = Column(String(32), nullable=True)
    is_vpn_proxy = Column(Integer, nullable=True)
    geo_confidence = Column(Float, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )

    # --------------------------------------------------------
    # Relationship
    # --------------------------------------------------------

    email = relationship(
        "Dev2Email",
        back_populates="fingerprint",
    )

    campaign_members = relationship(
        "Dev2CampaignMember",
        back_populates="fingerprint",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # --------------------------------------------------------
    # Indexes
    # --------------------------------------------------------

    __table_args__ = (
        Index(
            "ix_dev2_fp_tenant_created",
            "tenant_id",
            "created_at",
        ),
    )


# ============================================================
# CAMPAIGN
# ============================================================

class Dev2Campaign(Base):
    """
    Represents a correlated multi-tenant email campaign.

    A campaign is created when fingerprints from at least
    two different tenants are correlated within the configured
    correlation window.
    """

    __tablename__ = "dev2_campaigns"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)

    campaign_id = Column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    first_seen = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    last_seen = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    tenant_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    email_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    status = Column(
        String(50),
        nullable=False,
        default="ACTIVE",
        index=True,
    )

    summary = Column(
        Text,
        nullable=True,
    )

    # --------------------------------------------------------
    # Relationship
    # --------------------------------------------------------

    members = relationship(
        "Dev2CampaignMember",
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # --------------------------------------------------------
    # Index
    # --------------------------------------------------------

    __table_args__ = (
        Index(
            "ix_dev2_campaign_status_last_seen",
            "status",
            "last_seen",
        ),
    )


# ============================================================
# CAMPAIGN MEMBER
# ============================================================

class Dev2CampaignMember(Base):
    """
    Connects a fingerprint to a campaign.

    This table allows one campaign to contain fingerprints
    originating from multiple tenants.

    Example:

        Campaign CMP-001
          ├── IITB fingerprint
          ├── NITK fingerprint
          └── IITD fingerprint
    """

    __tablename__ = "dev2_campaign_members"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    campaign_id = Column(
        Integer,
        ForeignKey(
            "dev2_campaigns.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    fingerprint_id = Column(
        Integer,
        ForeignKey(
            "dev2_fingerprints.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    tenant_id = Column(
        String(100),
        nullable=False,
        index=True,
    )

    similarity = Column(
        Float,
        nullable=True,
    )

    correlation_distance = Column(
        Integer,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    # --------------------------------------------------------
    # Relationships
    # --------------------------------------------------------

    campaign = relationship(
        "Dev2Campaign",
        back_populates="members",
    )

    fingerprint = relationship(
        "Dev2Fingerprint",
        back_populates="campaign_members",
    )

    # --------------------------------------------------------
    # Constraints / indexes
    # --------------------------------------------------------

    __table_args__ = (

        # Prevent the same fingerprint from being inserted
        # into the same campaign more than once.
        UniqueConstraint(
            "campaign_id",
            "fingerprint_id",
            name="uq_dev2_campaign_fingerprint",
        ),

        Index(
            "ix_dev2_member_campaign_tenant",
            "campaign_id",
            "tenant_id",
        ),
    )
