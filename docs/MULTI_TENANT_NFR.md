# Multi-tenant isolation & enterprise NFR baseline

**Status:** ACTIVE baseline (foundations)
**Related:** `docs/AI_SENA_OPERATING_INSTRUCTIONS.md` §8, `services/runtime_ops/tenant.py`

## Multi-tenant isolation

* Every request that reads or writes tenant-owned data MUST carry an explicit `tenant_id`.
* Use `services.runtime_ops.tenant.require_tenant_id` and `assert_same_tenant` at API boundaries.
* Cross-tenant access is always denied; failures must be loud and actionable (not silent empty results).
* Feature flag `tenant.isolation_enforced` defaults to **true**.

## Standing NFRs (checklist for every change)

| NFR | Minimum |
|-----|--------|
| Resilience | Prefer retries with backoff on external I/O; no swallowed exceptions |
| Observability | Structured logs; health via operator diagnostics |
| Security logging | Authz denials and remediation actions logged |
| RBAC | Config console actions treated as privileged; wire roles before production |
| Backward compatibility | Additive schema/flags preferred; destructive changes need migration + rollback |
| Capacity | Document early-warning metrics when adding heavy paths |

## Implementation notes

* Full row-level DB isolation and IdP-backed RBAC remain follow-on work.
* This baseline prevents new code from ignoring tenant context.
