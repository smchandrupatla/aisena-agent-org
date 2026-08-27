# Operating gaps — foundations delivered

**Branch / PR:** `feat/operating-gaps-foundations`  
**Date:** 2026-08-27

This increment implements **foundations** for the five remaining Operating Instructions gaps. It does not claim full production multi-tenant SaaS or a fully wired Flask API on `main` (note: `services/api/app.py` on main may still be incomplete).

| Gap | Deliverable |
|-----|-------------|
| Physical sibling / clean extraction | `project/extraction/APPLICATION_PATHS.json`, `scripts/extract_application_repo.py`, tests |
| Configuration console + runtime apply | `services/runtime_ops/feature_flags.py`, portal `config-console.html` + JS |
| Operator self-service + feature flags | `services/runtime_ops/operator_recovery.py`, remediation actions, diagnostics |
| Multi-tenant / NFR hardening | `services/runtime_ops/tenant.py`, `docs/MULTI_TENANT_NFR.md` |
| Scheduled dependency scanning | `.github/dependabot.yml`, `.github/workflows/security-scan.yml` |

## How to verify

```bash
python -m unittest services.runtime_ops.test_runtime_ops -v
python -m unittest scripts.test_extract_application_repo -v
python3 scripts/extract_application_repo.py --output /tmp/aisena-app-extract --dry-run
```

Open `services/capabilities_site/config-console.html` via the capabilities site when deployed.

## Follow-ons

1. Mount runtime routes on the real API (`/api/runtime/diagnostics|flags|remediate`).
2. Persist flags in Postgres with RBAC.
3. Expand extraction manifest as application packages stabilize.
4. Treat Dependabot/security-scan High findings as human review queue (Operating Instructions §9).
