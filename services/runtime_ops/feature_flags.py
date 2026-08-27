"""In-process feature flags with optional JSON persistence — runtime apply, no restart."""

from __future__ import annotations

import json
import os
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any

_DEFAULTS: dict[str, Any] = {
    "screening.enabled": True,
    "screening.stub_mode": True,
    "operator.remediation_enabled": True,
    "ui.show_diagnostics": True,
    "tenant.isolation_enforced": True,
}


class FeatureFlagStore:
    """Thread-safe flag store. Changes apply immediately to subsequent reads."""

    def __init__(self, path: Path | None = None, defaults: dict[str, Any] | None = None):
        self._path = path
        self._lock = threading.RLock()
        self._flags: dict[str, Any] = deepcopy(defaults or _DEFAULTS)
        if path and path.is_file():
            self._load()

    def _load(self) -> None:
        assert self._path is not None
        data = json.loads(self._path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("feature flag file must be a JSON object")
        with self._lock:
            self._flags.update(data)

    def _persist(self) -> None:
        if not self._path:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        with self._lock:
            payload = json.dumps(self._flags, indent=2, sort_keys=True)
        tmp.write_text(payload + "\n", encoding="utf-8")
        tmp.replace(self._path)

    def list_flags(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._flags)

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._flags.get(key, default)

    def set(self, key: str, value: Any) -> dict[str, Any]:
        if not key or not isinstance(key, str):
            raise ValueError("flag key must be a non-empty string")
        with self._lock:
            self._flags[key] = value
            snapshot = dict(self._flags)
        self._persist()
        return snapshot

    def set_many(self, updates: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(updates, dict):
            raise ValueError("updates must be a dict")
        with self._lock:
            self._flags.update(updates)
            snapshot = dict(self._flags)
        self._persist()
        return snapshot


_store: FeatureFlagStore | None = None
_store_lock = threading.Lock()


def get_flag_store() -> FeatureFlagStore:
    global _store
    with _store_lock:
        if _store is None:
            path_env = os.environ.get("AISENA_FEATURE_FLAGS_PATH", "")
            path = Path(path_env) if path_env else None
            _store = FeatureFlagStore(path=path)
        return _store
