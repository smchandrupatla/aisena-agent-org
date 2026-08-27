"""Operator diagnostics and safe self-service remediation actions."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable

from .feature_flags import FeatureFlagStore, get_flag_store


@dataclass
class RemediationResult:
    action: str
    ok: bool
    message: str
    next_steps: str
    details: dict[str, Any] = field(default_factory=dict)


class OperatorRecoveryService:
    """Health snapshot + bounded remediation (retry / reset / clear-cache style)."""

    def __init__(
        self,
        flags: FeatureFlagStore | None = None,
        health_probes: dict[str, Callable[[], dict[str, Any]]] | None = None,
    ):
        self._flags = flags or get_flag_store()
        self._probes = health_probes or {
            "api": lambda: {"status": "up", "detail": "process-local"},
            "feature_flags": lambda: {
                "status": "up",
                "flag_count": len(self._flags.list_flags()),
            },
        }
        self._cache: dict[str, Any] = {}
        self._started_at = time.time()

    def diagnostics(self) -> dict[str, Any]:
        components = {}
        overall = "healthy"
        for name, probe in self._probes.items():
            try:
                result = probe()
                components[name] = result
                if result.get("status") not in ("up", "healthy", "ok"):
                    overall = "degraded"
            except Exception as exc:  # noqa: BLE001 — surface probe failures to operators
                components[name] = {"status": "down", "error": str(exc)}
                overall = "unhealthy"
        return {
            "overall": overall,
            "uptime_seconds": int(time.time() - self._started_at),
            "components": components,
            "flags": self._flags.list_flags(),
            "operator_hint": (
                "If overall is degraded, try remediation actions: clear_cache, "
                "reset_feature_defaults, or disable a misbehaving feature flag."
            ),
        }

    def list_actions(self) -> list[dict[str, str]]:
        return [
            {
                "id": "clear_cache",
                "label": "Clear in-process operator cache",
                "description": "Drops local diagnostic cache. Safe; no data loss.",
            },
            {
                "id": "reset_feature_defaults",
                "label": "Reset feature flags to defaults",
                "description": "Restores built-in safe defaults. Runtime apply, no restart.",
            },
            {
                "id": "disable_screening",
                "label": "Disable screening feature",
                "description": "Sets screening.enabled=false so a misbehaving path can be stopped without a deploy.",
            },
            {
                "id": "enable_screening",
                "label": "Enable screening feature",
                "description": "Sets screening.enabled=true.",
            },
        ]

    def remediate(self, action: str) -> RemediationResult:
        if not self._flags.get("operator.remediation_enabled", True):
            return RemediationResult(
                action=action,
                ok=False,
                message="Remediation is disabled by feature flag operator.remediation_enabled.",
                next_steps="Ask an administrator to enable operator.remediation_enabled, then retry.",
            )

        if action == "clear_cache":
            self._cache.clear()
            return RemediationResult(
                action=action,
                ok=True,
                message="Operator cache cleared.",
                next_steps="Refresh the diagnostics dashboard to confirm component status.",
            )

        if action == "reset_feature_defaults":
            from .feature_flags import _DEFAULTS

            self._flags.set_many(dict(_DEFAULTS))
            return RemediationResult(
                action=action,
                ok=True,
                message="Feature flags reset to safe defaults.",
                next_steps="Review flags in the configuration console; re-enable only what you need.",
            )

        if action == "disable_screening":
            self._flags.set("screening.enabled", False)
            return RemediationResult(
                action=action,
                ok=True,
                message="screening.enabled set to false (runtime, no restart).",
                next_steps="Confirm in UI that screening is stopped; re-enable when safe.",
            )

        if action == "enable_screening":
            self._flags.set("screening.enabled", True)
            return RemediationResult(
                action=action,
                ok=True,
                message="screening.enabled set to true (runtime, no restart).",
                next_steps="Confirm screening resumes in the diagnostics view.",
            )

        return RemediationResult(
            action=action,
            ok=False,
            message=f"Unknown remediation action: {action}",
            next_steps="Use one of: clear_cache, reset_feature_defaults, disable_screening, enable_screening.",
        )
