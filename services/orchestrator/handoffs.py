"""Cross-agent handoffs: how experts assigned to different workstreams coordinate.

Two kinds are recorded, both required for the "agents work with each other when
implementing" behavior (spec Section 5 — deliberate, flag dependencies/conflicts,
converge on an implementation):

- dependency: a downstream workstream's expert needs an upstream workstream's
  output before they can proceed (e.g. Frontend needs the Backend API contract).
- review: a cross-cutting expert (Security & Compliance, QA & Test Automation)
  must review every other workstream before it is marked ready.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from models import Handoff


class HandoffStore:
    def __init__(self, root_dir: Path):
        self.root_dir = Path(root_dir) / "handoffs"
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

    def _save(self, app_id: str, handoffs: list[dict[str, Any]]) -> None:
        self._path_for(app_id).write_text(json.dumps(handoffs, indent=2), encoding="utf-8")

    def list_handoffs(self, app_id: str) -> list[dict[str, Any]]:
        return self._load(app_id)

    def create_handoff(
        self,
        app_id: str,
        kind: str,
        from_workstream: dict[str, Any],
        to_workstream: dict[str, Any],
        note: str,
    ) -> dict[str, Any]:
        with self._lock:
            handoffs = self._load(app_id)
            numbers = [int(h["id"].replace("HANDOFF-", "")) for h in handoffs if h["id"].startswith("HANDOFF-")]
            next_num = max(numbers) + 1 if numbers else 1
            handoff = Handoff(
                id=f"HANDOFF-{str(next_num).zfill(4)}",
                app_id=app_id,
                kind=kind,
                from_workstream_id=from_workstream["id"],
                from_expert=from_workstream.get("assigned_expert"),
                to_workstream_id=to_workstream["id"],
                to_expert=to_workstream.get("assigned_expert"),
                note=note,
            ).to_dict()
            handoffs.append(handoff)
            self._save(app_id, handoffs)
            return handoff

    def acknowledge_handoff(self, app_id: str, handoff_id: str) -> dict[str, Any] | None:
        with self._lock:
            handoffs = self._load(app_id)
            handoff = next((h for h in handoffs if h["id"] == handoff_id), None)
            if not handoff:
                return None
            handoff["status"] = "acknowledged"
            self._save(app_id, handoffs)
            return handoff
