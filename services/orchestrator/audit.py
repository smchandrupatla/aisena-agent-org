"""Append-only per-app audit log (REQ-0006 / REQ-0007 traceability requirement)."""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from models import AuditEntry


class AuditLog:
    def __init__(self, root_dir: Path):
        self.root_dir = Path(root_dir) / "audit"
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path_for(self, app_id: str) -> Path:
        return self.root_dir / f"{app_id}.jsonl"

    def record(self, app_id: str, actor: str, action: str, details: dict[str, Any]) -> AuditEntry:
        entry = AuditEntry(app_id=app_id, actor=actor, action=action, details=details)
        with self._lock:
            with open(self._path_for(app_id), "a", encoding="utf-8") as f:
                f.write(json.dumps(entry.to_dict()) + "\n")
        return entry

    def read(self, app_id: str) -> list[dict[str, Any]]:
        path = self._path_for(app_id)
        if not path.exists():
            return []
        entries = []
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except Exception:
                continue
        return entries
