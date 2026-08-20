"""Persistent registry of every application ever built through the engine.

Backed by a single JSON file so the full history of apps is queryable
independent of any one project's own storage.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from models import AppProject, utc_now_iso


class AppRegistry:
    def __init__(self, root_dir: Path):
        self.root_dir = Path(root_dir)
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.root_dir / "apps.json"
        self._lock = threading.Lock()
        if not self.path.exists():
            self.path.write_text("[]", encoding="utf-8")

    def _load(self) -> list[dict[str, Any]]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _save(self, apps: list[dict[str, Any]]) -> None:
        self.path.write_text(json.dumps(apps, indent=2), encoding="utf-8")

    def list_apps(self) -> list[dict[str, Any]]:
        return self._load()

    def get_app(self, app_id: str) -> dict[str, Any] | None:
        return next((a for a in self._load() if a["id"] == app_id), None)

    def _next_id(self, apps: list[dict[str, Any]]) -> str:
        numbers = [int(a["id"].replace("APP-", "")) for a in apps if a["id"].startswith("APP-")]
        next_num = max(numbers) + 1 if numbers else 1
        return f"APP-{str(next_num).zfill(4)}"

    def create_app(self, name: str, client_id: str, app_type: str, push_mode: str, repo: str | None) -> dict[str, Any]:
        with self._lock:
            apps = self._load()
            app = AppProject(
                id=self._next_id(apps),
                name=name,
                client_id=client_id,
                app_type=app_type,
                push_mode=push_mode,
                repo=repo,
            ).to_dict()
            apps.append(app)
            self._save(apps)
            return app

    def update_app(self, app_id: str, **updates: Any) -> dict[str, Any] | None:
        with self._lock:
            apps = self._load()
            app = next((a for a in apps if a["id"] == app_id), None)
            if not app:
                return None
            app.update(updates)
            self._save(apps)
            return app

    def append_spec(self, app_id: str, spec_text: str) -> dict[str, Any] | None:
        with self._lock:
            apps = self._load()
            app = next((a for a in apps if a["id"] == app_id), None)
            if not app:
                return None
            app.setdefault("spec_history", []).append({"submitted_at": utc_now_iso(), "spec": spec_text})
            self._save(apps)
            return app

    def append_workstreams(self, app_id: str, workstreams: list[dict[str, Any]]) -> dict[str, Any] | None:
        with self._lock:
            apps = self._load()
            app = next((a for a in apps if a["id"] == app_id), None)
            if not app:
                return None
            app.setdefault("workstreams", []).extend(workstreams)
            self._save(apps)
            return app
