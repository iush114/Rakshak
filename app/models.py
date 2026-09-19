import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, Float, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    """Rakshak workspace identity.

    ``id`` is the internal Rakshak primary key. ``github_user_id`` is GitHub's
    stable numeric user ID and is the durable external identity used for
    upserts. ``github_login`` is the current login (mutable) and is NEVER used
    as an identity key.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    github_user_id: Mapped[int] = mapped_column(
        BigInteger,
        unique=True,
        index=True,
        nullable=False,
    )

    github_login: Mapped[str] = mapped_column(String(100), nullable=False)

    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    html_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    scans = relationship(
        "Scan",
        back_populates="user",
    )


class UserInstallation(Base):
    """Maps a GitHub App installation to the Rakshak workspace that established it.

    One installation maps to one workspace (first workspace to establish the
    mapping owns it). Used to safely resolve webhook scans to an owner.
    """

    __tablename__ = "user_installations"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    installation_id: Mapped[int] = mapped_column(
        BigInteger,
        unique=True,
        index=True,
        nullable=False,
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    user = relationship(
        "User",
    )


class UserRepository(Base):
    """Maps a GitHub repository to a Rakshak workspace.

    A single repository may be associated with more than one workspace, so
    (user_id, repository_full_name) is the uniqueness boundary — never the
    repository name alone.
    """

    __tablename__ = "user_repositories"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "repository_full_name",
            name="uq_user_repositories_user_repo",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    repository_full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    installation_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    user = relationship(
        "User",
    )


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    target_path: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(50), default="completed", index=True)

    repository: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    event_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(100), nullable=True)

    code_scanning: Mapped[bool] = mapped_column(Boolean, default=False)
    dependency_scanning: Mapped[bool] = mapped_column(Boolean, default=False)
    secret_detection: Mapped[bool] = mapped_column(Boolean, default=False)
    container_scanning: Mapped[bool] = mapped_column(Boolean, default=False)

    total_findings: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    high_count: Mapped[int] = mapped_column(Integer, default=0)
    medium_count: Mapped[int] = mapped_column(Integer, default=0)
    low_count: Mapped[int] = mapped_column(Integer, default=0)

    overall_risk: Mapped[float] = mapped_column(Float, default=0)

    started_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    security_gate_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True,
    )
    security_gate_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )

    # Owning Rakshak workspace (User). NULL = historical/system record that is
    # hidden from all authenticated workspaces but never deleted.
    user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    user = relationship(
        "User",
        back_populates="scans",
    )

    findings = relationship(
        "Finding",
        back_populates="scan",
        cascade="all, delete-orphan",
    )


class GitHubWebhookDelivery(Base):
    __tablename__ = "github_webhook_deliveries"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    delivery_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )

    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    action: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    repository: Mapped[str | None] = mapped_column(
        String(255),
        index=True,
        nullable=True,
    )

    owner: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    ref: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    commit_sha: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="received",
        index=True,
        nullable=False,
    )

    received_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
        nullable=False,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    installation_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    scan_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scans.id"),
        nullable=False,
    )

    finding_key: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )
    scanner_type: Mapped[str] = mapped_column(
        String(30),
        default="unknown",
        nullable=False,
        index=True,
    )
    lifecycle_status: Mapped[str] = mapped_column(
        String(20),
        default="new",
        nullable=False,
        index=True,
    )
    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fixed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    vulnerability_id: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")

    tool: Mapped[str] = mapped_column(String(100))
    severity: Mapped[str] = mapped_column(String(50))
    priority: Mapped[str] = mapped_column(String(50), default="")

    risk_score: Mapped[float] = mapped_column(Float, default=0)
    exploitability: Mapped[float] = mapped_column(Float, default=0)

    target: Mapped[str] = mapped_column(String(500), default="")
    package_name: Mapped[str] = mapped_column(String(300), default="")
    installed_version: Mapped[str] = mapped_column(String(100), default="")
    fixed_version: Mapped[str] = mapped_column(String(100), default="")

    fix_available: Mapped[bool] = mapped_column(Boolean, default=False)
    production: Mapped[bool] = mapped_column(Boolean, default=False)

    affected_packages: Mapped[dict | list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    ai_explanation: Mapped[str] = mapped_column(Text, default="")
    potential_impact: Mapped[str] = mapped_column(Text, default="")
    recommended_action: Mapped[str] = mapped_column(Text, default="")
    risk_summary: Mapped[str] = mapped_column(Text, default="")

    scan = relationship(
        "Scan",
        back_populates="findings",
    )


class FindingLifecycle(Base):
    __tablename__ = "finding_lifecycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    finding_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    context: Mapped[str] = mapped_column(String(500), index=True)
    scanner_type: Mapped[str] = mapped_column(String(30), index=True)
    vulnerability_id: Mapped[str] = mapped_column(String(200))
    package_name: Mapped[str] = mapped_column(String(300), default="")
    target: Mapped[str] = mapped_column(String(500), default="")
    lifecycle_status: Mapped[str] = mapped_column(String(20), default="new", index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fixed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    first_seen_scan_id: Mapped[str] = mapped_column(String(36))
    last_seen_scan_id: Mapped[str] = mapped_column(String(36))