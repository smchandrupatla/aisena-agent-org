"""Core Orchestrator: decomposes specs, assigns dynamic experts, and drives the
push-mode-aware GitHub workflow, audit trail, and ticket escalation described in
REQ-0007 / ADR-0004 (generalizing the single-app Sena model to a multi-client,
multi-app autonomous dev shop).
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from app_registry import AppRegistry
from artifacts import ArtifactStore, ReviewStore
from audit import AuditLog
from capability_registry import CapabilityRegistry
from github_client import GitHubClient
from handoffs import HandoffStore
from models import AppType, PushMode, slugify, utc_now_iso
from tickets import TicketStore

# Keyword -> workstream title/description used to decompose a free-text spec into
# workstreams. This is a deterministic heuristic seam, intentionally isolated here
# so it can be swapped for a real LLM-based decomposition later without touching
# any other module.
_WORKSTREAM_KEYWORDS: list[tuple[str, str]] = [
    (r"\b(ui|frontend|front-end|screen|page|dashboard|portal)\b", "Frontend/UX"),
    (r"\b(api|backend|back-end|service|endpoint|business logic)\b", "Backend Services"),
    (r"\b(database|schema|table|persistence|storage)\b", "Data & Persistence"),
    (r"\b(auth|security|compliance|encryption|rbac|permission)\b", "Security & Compliance"),
    (r"\b(deploy|infra|infrastructure|kubernetes|docker|ci/?cd|pipeline)\b", "DevOps & Infrastructure"),
    (r"\b(test|qa|quality|regression)\b", "QA & Test Automation"),
    (r"\b(integrat|third[- ]party|webhook|external api)\b", "Integration"),
]

_KNOWN_ENTERPRISE_INTEGRATION_MANIFEST = "Enterprise Interoperability Contract"

# Sequencing: a workstream in this map needs the output of the workstreams it
# lists before its expert can actually start implementing (e.g. Frontend needs
# the Backend API contract; Integration needs the Backend services in place).
_DEPENDS_ON: dict[str, list[str]] = {
    "Backend Services": ["Data & Persistence"],
    "Integration": ["Backend Services"],
    "Frontend/UX": ["Backend Services"],
}

# Cross-cutting experts who must review every other workstream in the app
# before that workstream's implementation is considered ready.
_REVIEWER_TITLES = {"Security & Compliance", "QA & Test Automation"}


class Orchestrator:
    def __init__(self, root_dir: Path, agents_dir: Path, github_client: GitHubClient | None = None):
        self.apps = AppRegistry(root_dir)
        self.audit = AuditLog(root_dir)
        self.tickets = TicketStore(root_dir)
        self.handoffs = HandoffStore(root_dir)
        self.artifacts = ArtifactStore(root_dir)
        self.reviews = ReviewStore(root_dir)
        self.capabilities = CapabilityRegistry(agents_dir)
        self.github = github_client or GitHubClient()

    @staticmethod
    def find_workstream(app: dict[str, Any], workstream_id: str) -> dict[str, Any] | None:
        return next((w for w in app.get("workstreams", []) if w["id"] == workstream_id), None)

    # ------------------------------------------------------------------
    # Client onboarding
    # ------------------------------------------------------------------
    def onboard_client(self, client_id: str, app_name: str, app_type: str, push_mode: str, create_repo: bool = False) -> dict[str, Any]:
        if app_type not in (AppType.MOBILE.value, AppType.ENTERPRISE.value):
            raise ValueError(f"Unknown app_type: {app_type}")
        if push_mode not in (PushMode.AUTO_PUSH.value, PushMode.MANUAL_APPROVAL.value):
            raise ValueError(f"Unknown push_mode: {push_mode}")

        repo_name = slugify(app_name)
        repo = None
        if create_repo and self.github.enabled:
            self.github.create_repository(repo_name)
            repo = repo_name

        app = self.apps.create_app(name=app_name, client_id=client_id, app_type=app_type, push_mode=push_mode, repo=repo)
        self.audit.record(app["id"], actor="orchestrator", action="app_onboarded", details={
            "client_id": client_id, "app_type": app_type, "push_mode": push_mode, "repo": repo,
        })
        return app

    # ------------------------------------------------------------------
    # Spec intake -> workstream decomposition -> expert assignment
    # ------------------------------------------------------------------
    def decompose_spec(self, spec_text: str) -> list[dict[str, str]]:
        lowered = spec_text.lower()
        matched = []
        for pattern, title in _WORKSTREAM_KEYWORDS:
            if re.search(pattern, lowered):
                matched.append(title)
        if not matched:
            matched = ["Core Implementation"]
        return [{"title": title, "description": f"{title} work derived from the submitted specification."} for title in matched]

    def submit_spec(self, app_id: str, spec_text: str) -> dict[str, Any]:
        app = self.apps.get_app(app_id)
        if not app:
            raise ValueError(f"Unknown app_id: {app_id}")

        self.apps.append_spec(app_id, spec_text)
        self.audit.record(app_id, actor="orchestrator", action="spec_submitted", details={"length": len(spec_text)})

        candidate_workstreams = self.decompose_spec(spec_text)
        assigned: list[dict[str, Any]] = []
        for idx, candidate in enumerate(candidate_workstreams, start=1):
            expert = self.capabilities.match_expert(candidate["description"])
            if not expert:
                expert = self.capabilities.synthesize_expert(candidate["title"], candidate["description"])
            workstream = {
                "id": f"WS-{len(app.get('workstreams', [])) + idx}",
                "title": candidate["title"],
                "description": candidate["description"],
                "assigned_expert": expert,
            }
            assigned.append(workstream)

        self.apps.append_workstreams(app_id, assigned)
        self.audit.record(app_id, actor="orchestrator", action="workstreams_assigned", details={"workstreams": assigned})

        new_handoffs = self.coordinate_workstreams(app_id)

        interoperability = None
        if app["app_type"] == AppType.ENTERPRISE.value:
            interoperability = self.check_interoperability(app_id)

        return {"app_id": app_id, "workstreams": assigned, "handoffs": new_handoffs, "interoperability": interoperability}

    # ------------------------------------------------------------------
    # Cross-agent coordination (Section 5: experts deliberate, flag
    # dependencies/conflicts, and converge on an implementation together)
    # ------------------------------------------------------------------
    def coordinate_workstreams(self, app_id: str) -> list[dict[str, Any]]:
        app = self.apps.get_app(app_id)
        if not app:
            raise ValueError(f"Unknown app_id: {app_id}")

        by_title: dict[str, list[dict[str, Any]]] = {}
        for ws in app.get("workstreams", []):
            by_title.setdefault(ws["title"], []).append(ws)

        existing_pairs = {
            (h["from_workstream_id"], h["to_workstream_id"]) for h in self.handoffs.list_handoffs(app_id)
        }
        created: list[dict[str, Any]] = []

        def _record(kind: str, source_ws: dict[str, Any], target_ws: dict[str, Any], note: str) -> None:
            pair = (source_ws["id"], target_ws["id"])
            if pair in existing_pairs or source_ws["id"] == target_ws["id"]:
                return
            handoff = self.handoffs.create_handoff(app_id, kind=kind, from_workstream=source_ws, to_workstream=target_ws, note=note)
            created.append(handoff)
            existing_pairs.add(pair)

        for title, deps in _DEPENDS_ON.items():
            for target_ws in by_title.get(title, []):
                for dep_title in deps:
                    for source_ws in by_title.get(dep_title, []):
                        _record(
                            "dependency", source_ws, target_ws,
                            f"{source_ws['title']} (owned by {source_ws['assigned_expert']}) must hand off its output "
                            f"before {target_ws['title']} (owned by {target_ws['assigned_expert']}) can proceed.",
                        )

        for reviewer_title in _REVIEWER_TITLES:
            for reviewer_ws in by_title.get(reviewer_title, []):
                for title, ws_list in by_title.items():
                    if title == reviewer_title:
                        continue
                    for target_ws in ws_list:
                        _record(
                            "review", reviewer_ws, target_ws,
                            f"{reviewer_ws['title']} (owned by {reviewer_ws['assigned_expert']}) must review "
                            f"{target_ws['title']} (owned by {target_ws['assigned_expert']}) before it is marked ready.",
                        )

        if created:
            self.audit.record(app_id, actor="orchestrator", action="handoffs_created", details={"count": len(created)})
        return created

    # ------------------------------------------------------------------
    # Implementation artifacts & peer review (Section 5: an agent implements
    # and produces an artifact, another agent peer-reviews it before it's ready)
    # ------------------------------------------------------------------
    def submit_artifact(self, app_id: str, workstream_id: str, title: str, description: str, produced_by: str | None = None) -> dict[str, Any]:
        app = self.apps.get_app(app_id)
        if not app:
            raise ValueError(f"Unknown app_id: {app_id}")
        workstream = self.find_workstream(app, workstream_id)
        if not workstream:
            raise ValueError(f"Unknown workstream_id: {workstream_id}")

        reviewers = [
            {"expert": h["from_expert"], "workstream_id": h["from_workstream_id"]}
            for h in self.handoffs.list_handoffs(app_id)
            if h["kind"] == "review" and h["to_workstream_id"] == workstream_id
        ]
        artifact = self.artifacts.create_artifact(
            app_id, workstream_id=workstream_id, title=title, description=description,
            produced_by=produced_by or workstream.get("assigned_expert"), reviewers=reviewers,
        )
        self.audit.record(app_id, actor=artifact["produced_by"] or "orchestrator", action="artifact_submitted", details={
            "artifact_id": artifact["id"], "workstream_id": workstream_id, "pending_reviewers": [r["expert"] for r in reviewers],
        })
        return artifact

    def review_artifact(self, app_id: str, artifact_id: str, reviewer: str, verdict: str, comments: str) -> dict[str, Any]:
        if verdict not in ("approved", "changes_requested"):
            raise ValueError(f"Unknown verdict: {verdict}")
        artifact = self.artifacts.get_artifact(app_id, artifact_id)
        if not artifact:
            raise ValueError(f"Unknown artifact_id: {artifact_id}")

        review = self.reviews.create_review(app_id, artifact_id=artifact_id, reviewer=reviewer, verdict=verdict, comments=comments)
        artifact = self.artifacts.update_status(app_id, artifact_id, verdict)
        self.audit.record(app_id, actor=reviewer, action="artifact_reviewed", details={
            "artifact_id": artifact_id, "verdict": verdict, "comments": comments,
        })

        if verdict == "changes_requested":
            self._request_revision(app_id, artifact, reviewer, comments)

        return {"artifact": artifact, "review": review}

    def _request_revision(self, app_id: str, artifact: dict[str, Any], reviewer: str, comments: str) -> None:
        """Send the artifact's original implementer a revision handoff from the reviewer."""
        app = self.apps.get_app(app_id)
        if not app:
            return
        reviewer_workstream_id = next(
            (r["workstream_id"] for r in artifact.get("reviewers", []) if r["expert"] == reviewer), None,
        )
        target_ws = self.find_workstream(app, artifact["workstream_id"])
        source_ws = self.find_workstream(app, reviewer_workstream_id) if reviewer_workstream_id else None
        if not target_ws or not source_ws:
            return
        self.handoffs.create_handoff(
            app_id, kind="revision", from_workstream=source_ws, to_workstream=target_ws,
            note=f"Changes requested on artifact '{artifact['title']}' by {reviewer}: {comments}",
        )
        self.audit.record(app_id, actor="orchestrator", action="revision_requested", details={"artifact_id": artifact["id"]})

    # ------------------------------------------------------------------
    # Enterprise interoperability (Section 6 of the spec)
    # ------------------------------------------------------------------
    def check_interoperability(self, app_id: str) -> dict[str, Any]:
        app = self.apps.get_app(app_id)
        if not app:
            raise ValueError(f"Unknown app_id: {app_id}")

        other_enterprise_apps = [
            a for a in self.apps.list_apps()
            if a["app_type"] == AppType.ENTERPRISE.value and a["id"] != app_id
        ]
        report = {
            "requires_integration_contract": True,
            "contract_name": _KNOWN_ENTERPRISE_INTEGRATION_MANIFEST,
            "peer_enterprise_apps": [{"id": a["id"], "name": a["name"]} for a in other_enterprise_apps],
            "note": "Manual API-contract compatibility verification recommended against each peer app.",
        }
        self.audit.record(app_id, actor="orchestrator", action="interoperability_checked", details=report)
        return report

    # ------------------------------------------------------------------
    # Issue/ticket escalation (Section 8 of the spec)
    # ------------------------------------------------------------------
    def escalate_issue(self, app_id: str, title: str, description: str, attempted: str, why_blocked: str, decision_needed: str) -> dict[str, Any]:
        app = self.apps.get_app(app_id)
        if not app:
            raise ValueError(f"Unknown app_id: {app_id}")

        github_issue_number = None
        if app.get("repo") and self.github.enabled:
            body = (
                f"App: {app_id} ({app['name']})\n\nDescription: {description}\n\n"
                f"Attempted: {attempted}\n\nWhy blocked: {why_blocked}\n\nDecision needed: {decision_needed}"
            )
            issue = self.github.create_issue(app["repo"], title=title, body=body, labels=[app_id])
            github_issue_number = issue.get("number")

        ticket = self.tickets.create_ticket(
            app_id, title=title, description=description, attempted=attempted,
            why_blocked=why_blocked, decision_needed=decision_needed, github_issue_number=github_issue_number,
        )
        self.audit.record(app_id, actor="orchestrator", action="ticket_opened", details={"ticket_id": ticket["id"]})
        return ticket

    # ------------------------------------------------------------------
    # Traceability
    # ------------------------------------------------------------------
    def get_app_history(self, app_id: str) -> dict[str, Any]:
        app = self.apps.get_app(app_id)
        if not app:
            raise ValueError(f"Unknown app_id: {app_id}")
        return {
            "app": app,
            "audit_trail": self.audit.read(app_id),
            "tickets": self.tickets.list_tickets(app_id),
            "handoffs": self.handoffs.list_handoffs(app_id),
            "artifacts": self.artifacts.list_artifacts(app_id),
            "reviews": self.reviews.list_reviews(app_id),
        }
