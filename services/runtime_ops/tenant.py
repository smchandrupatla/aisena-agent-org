"""Multi-tenant isolation helpers — baseline NFR enforcement points."""

from __future__ import annotations

from dataclasses import dataclass


class TenantIsolationError(ValueError):
    """Raised when tenant context is missing or cross-tenant access is attempted."""


@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    role: str = "operator"

    def __post_init__(self) -> None:
        if not self.tenant_id or not str(self.tenant_id).strip():
            raise TenantIsolationError("tenant_id is required")


def require_tenant_id(tenant_id: str | None) -> str:
    if not tenant_id or not str(tenant_id).strip():
        raise TenantIsolationError(
            "Missing tenant_id. Multi-tenant isolation requires an explicit tenant on every request."
        )
    return str(tenant_id).strip()


def assert_same_tenant(resource_tenant_id: str, request_tenant_id: str) -> None:
    a = require_tenant_id(resource_tenant_id)
    b = require_tenant_id(request_tenant_id)
    if a != b:
        raise TenantIsolationError(
            "Cross-tenant access denied. One customer's data must never be visible to another."
        )
