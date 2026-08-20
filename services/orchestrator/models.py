"""Data models for the Autonomous Dev Shop Orchestrator (REQ-0007 / ADR-0004)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PushMode(str, Enum):
    AUTO_PUSH = "auto_push"
    MANUAL_APPROVAL = "manual_approval"


class AppType(str, Enum):
    MOBILE = "mobile"
    ENTERPRISE = "enterprise"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    slug = _SLUG_RE.sub("-", text.strip().lower()).strip("-")
    return slug or "item"


@dataclass
class Workstream:
    id: str
    title: str
    description: str
    assigned_expert: str | None = None


@dataclass
class AppProject:
    id: str
    name: str
    client_id: str
    app_type: str
    push_mode: str
    repo: str | None
    created_at: str = field(default_factory=utc_now_iso)
    status: str = "active"
    spec_history: list[dict[str, Any]] = field(default_factory=list)
    workstreams: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Handoff:
    id: str
    app_id: str
    kind: str  # "dependency" | "review" | "revision"
    from_workstream_id: str
    from_expert: str | None
    to_workstream_id: str
    to_expert: str | None
    note: str
    status: str = "pending"
    created_at: str = field(default_factory=utc_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Artifact:
    id: str
    app_id: str
    workstream_id: str
    produced_by: str | None
    title: str
    description: str
    reviewers: list[dict[str, Any]] = field(default_factory=list)
    status: str = "in_review"  # in_review | approved | changes_requested
    created_at: str = field(default_factory=utc_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Review:
    id: str
    app_id: str
    artifact_id: str
    reviewer: str | None
    verdict: str  # approved | changes_requested
    comments: str
    created_at: str = field(default_factory=utc_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Ticket:
    id: str
    app_id: str
    title: str
    description: str
    attempted: str
    why_blocked: str
    decision_needed: str
    status: str = "open"
    github_issue_number: int | None = None
    created_at: str = field(default_factory=utc_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AuditEntry:
    app_id: str
    actor: str
    action: str
    details: dict[str, Any]
    ts: str = field(default_factory=utc_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
