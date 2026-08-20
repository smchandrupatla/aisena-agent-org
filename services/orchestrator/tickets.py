"""Per-app ticket/issue tracking (REQ-0007 Section 8: issues traceable to their originating app)."""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from models import Ticket


class TicketStore:
    def __init__(self, root_dir: Path):
        self.root_dir = Path(root_dir) / "tickets"
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path_for(self, app_id: str) -> Path:
        return self.root_dir / f"{app_id}.json"

    def _load(self, app_id: str) -> list[dict[str, Any]]:
        path = self._path_for(app_id)
        if not path.exists():
            return []
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _save(self, app_id: str, tickets: list[dict[str, Any]]) -> None:
        self._path_for(app_id).write_text(json.dumps(tickets, indent=2), encoding="utf-8")

    def list_tickets(self, app_id: str) -> list[dict[str, Any]]:
        return self._load(app_id)

    def create_ticket(
        self,
        app_id: str,
        title: str,
        description: str,
        attempted: str,
        why_blocked: str,
        decision_needed: str,
        github_issue_number: int | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            tickets = self._load(app_id)
            numbers = [int(t["id"].replace("TICKET-", "")) for t in tickets if t["id"].startswith("TICKET-")]
            next_num = max(numbers) + 1 if numbers else 1
            ticket = Ticket(
                id=f"TICKET-{str(next_num).zfill(4)}",
                app_id=app_id,
                title=title,
                description=description,
                attempted=attempted,
                why_blocked=why_blocked,
                decision_needed=decision_needed,
                github_issue_number=github_issue_number,
            ).to_dict()
            tickets.append(ticket)
            self._save(app_id, tickets)
            return ticket

    def resolve_ticket(self, app_id: str, ticket_id: str) -> dict[str, Any] | None:
        with self._lock:
            tickets = self._load(app_id)
            ticket = next((t for t in tickets if t["id"] == ticket_id), None)
            if not ticket:
                return None
            ticket["status"] = "resolved"
            self._save(app_id, tickets)
            return ticket
