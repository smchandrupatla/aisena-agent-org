# AISENA Enterprise Test Strategy and Framework

- Brand: AISENA (formerly HSFS Agent System)
- Program: Autonomous Delivery Shop
- Document Type: Enterprise Test Strategy
- Version: v0.1
- Owner: Implementation Manager
- Status: Draft
- Classification: Internal
- Last Updated: 2026-08-20
- Review Cycle: Quarterly and before each major release

---

## 1. Purpose and Scope

This strategy defines the test levels, quality controls, environments, evidence, and release gates required to validate AISENA from individual modules through production-representative rolling upgrades. It applies to the agent manager and orchestrator, Python services, Node.js/TypeScript backend services, React portals, event flows, data stores, infrastructure definitions, and integrations.

Production deployment is not automated. Continuous integration may build, test, and promote release candidates through non-production environments, but production changes require the human approval defined by AISENA governance.

## 2. Confirmed Technology Baseline

The repository currently contains the following implementation and test stack. Recommendations marked **Adopt** are target-state controls and must not be reported as operational until they are installed and produce evidence in CI.

| Area | Confirmed implementation | Current test capability | Strategic standard |
|---|---|---|---|
| Python services and agent manager | Python 3.12, Flask, Kafka, PostgreSQL, OpenSearch | `unittest`, pytest, Flask test client | pytest, `unittest.mock`, pytest-cov, Testcontainers where real dependencies are required |
| Backend services | Node.js 20, TypeScript, Express, KafkaJS, Temporal | Jest, ts-jest, Temporal test environment | Jest for unit/integration; Supertest for HTTP; Testcontainers for Kafka/PostgreSQL |
| Frontend portals | React 18, TypeScript, Vite | Vitest, React Testing Library, V8 coverage | Retain current stack; add axe-core and Playwright for browser E2E |
| Existing browser E2E | React CRM portal in Docker, Selenium Grid, pytest | Selenium 4 with Chrome | Retain during migration; adopt Playwright as the default for new cross-browser suites |
| Runtime topology | Docker Compose and Kubernetes manifests; PostgreSQL, Kafka, OpenSearch, Temporal | Compose configuration checks and smoke scripts | Add container structure, image scanning, ephemeral integration, and Kubernetes rollout suites |
| Observability | Prometheus, Grafana, Loki, OpenTelemetry; optional enterprise integrations | Runtime dashboards and smoke evidence | Use metrics, logs, and traces as assertions in performance, soak, resilience, and rollout tests |
| CI | No repository workflow is currently defined | Local/manual commands | Adopt GitHub Actions with protected environments and retained test evidence |

Java/Spring tooling is outside the current baseline and must be added only if a Java service is introduced.

## 3. Quality Principles

| Principle | Policy |
|---|---|
| Shift left | Linting, unit tests, static analysis, secrets scanning, and dependency checks run on each pull request. |
| Risk-based pyramid | Most tests are unit tests, fewer are service/API/contract tests, and a focused set covers system, UI, and non-functional behavior. |
| Production parity | System and non-functional tests use the same container images, orchestration model, configuration mechanism, probes, and network policy shape as production. |
| Automation first | Every repeatable test is automated. Exploratory testing, usability review, UAT, and penetration testing retain explicit manual evidence. |
| Traceability | Each requirement and acceptance criterion maps to one or more test IDs and retained results. |
| Determinism | Tests control clocks, random seeds, external responses, model versions, and test data wherever practical. Flaky tests do not gate releases until fixed or quarantined with an owner and expiry date. |
| Non-functional quality | Performance, resilience, security, accessibility, recovery, soak, and upgrade compatibility are planned release controls. |
| Least privilege | Test identities, tokens, and data are isolated by environment and contain no production secrets or unapproved personal data. |

## 4. Test Levels and Frameworks

### 4.1 Static Analysis and Unit Testing

**Objective:** Validate functions, classes, React components, workflow logic, and policy decisions without network, database, broker, or filesystem dependencies.

| Surface | Standard |
|---|---|
| Python | pytest or existing `unittest`; `unittest.mock`; pytest-cov (**Adopt**) |
| Node.js/TypeScript | Existing Jest/ts-jest suites; ESLint and TypeScript compilation |
| React | Existing Vitest, React Testing Library, `@testing-library/user-event`, and V8 coverage |
| Infrastructure | Hadolint and Checkov (**Adopt**); Compose config and Kubernetes manifest validation |

Core business logic must achieve at least 80% line coverage and 75% branch coverage. New or changed core modules must not reduce repository baseline coverage. Generated code, framework bootstrap files, and declarative manifests may be excluded with documented rationale.

### 4.2 Container Testing

**Objective:** Prove that each release image builds reproducibly, runs as the intended user, exposes only declared ports, honors resource settings, and passes startup, liveness, and readiness checks.

Required controls are Docker BuildKit build validation, Hadolint (**Adopt**), Trivy image and filesystem scanning (**Adopt**), Google Container Structure Tests (**Adopt**), and an isolated runtime smoke test. Images are identified by immutable digest in test evidence and deployment manifests.

Critical or High exploitable vulnerabilities block promotion unless the Security Engineer records a time-bound exception. Images must not contain embedded credentials, package-manager caches, test fixtures containing sensitive data, or unnecessary build tools.

### 4.3 API and Contract Testing

**Objective:** Validate REST endpoints and service contracts for schema, status, authentication, authorization, rate limits, idempotency, error handling, pagination, and version compatibility.

Existing Flask test clients and Jest suites remain valid. Adopt Supertest for Express APIs and pytest with httpx for Python black-box API tests. OpenAPI documents must pass Spectral linting and implementation conformance checks when specifications exist. Pact (**Adopt**) covers consumer-driven compatibility between independently released services.

Negative tests must include malformed payloads, unsupported media types, expired and insufficient credentials, tenant boundary violations, replayed requests, oversized inputs, dependency timeouts, and safe error redaction.

### 4.4 Service and Component Testing

**Objective:** Validate one deployable service with real infrastructure dependencies while virtualizing downstream application services.

Testcontainers (**Adopt**) supplies disposable PostgreSQL, Kafka, OpenSearch, and compatible infrastructure. WireMock or Mountebank (**Adopt**) simulates downstream HTTP behavior. Temporal workflows use the existing Temporal test environment with controlled time and activity stubs.

Event-driven tests assert topic, key, headers, schema, ordering assumptions, retry behavior, idempotency, dead-letter handling, and observable correlation IDs. Apicurio schemas and compatibility rules become release gates once event schemas are registered.

### 4.5 Data, Migration, and Search Testing

**Objective:** Protect schema compatibility, data integrity, tenant isolation, retention behavior, and search correctness.

Tests cover migrations from the current supported version and N-1, rollback or forward-fix behavior, constraints, transaction boundaries, duplicate events, reconciliation, backup restoration, and zero-row/large-volume edge cases. OpenSearch tests cover mappings, analyzers, indexing failures, reindexing, query relevance, and source-of-truth reconciliation.

Database changes use an expand/migrate/contract sequence. Destructive contract steps occur only after old application versions are removed and rollback criteria expire.

### 4.6 System Integration Testing

**Objective:** Validate cross-service flows through the deployed system and approved simulations of identity providers, GitHub, LLM providers, and other external systems.

An ephemeral Docker Compose or Kubernetes environment runs PostgreSQL, Kafka, OpenSearch, Temporal, services, and the applicable independent portal. LocalStack, WireMock, or provider sandboxes simulate external dependencies. Tests assert business outcomes, persisted state, emitted events, audit records, metrics, logs, and traces rather than only HTTP success.

Primary flows include ingestion to screening and persistence, case and audit creation, agent orchestration and handoff, project creation, failure recovery, and tenant/authorization isolation.

### 4.7 System, GUI, Accessibility, and Visual Testing

**Objective:** Validate complete user workflows, browser behavior, accessibility, responsive layouts, and user-visible error recovery.

The existing Selenium/pytest CRM portal suite remains supported. New E2E coverage should use Playwright (**Adopt**) for Chromium, Firefox, and WebKit, with API-assisted setup and isolated test accounts. React Testing Library remains the component-level functional standard.

Adopt axe-core for automated WCAG 2.2 AA checks, Playwright screenshot comparison for stable visual surfaces, and Lighthouse CI for key frontend performance and accessibility budgets. Manual keyboard, screen-reader, zoom, contrast, and exploratory checks supplement automation before major releases.

### 4.8 Agent and LLM Assurance

**Objective:** Validate agent decisions, tool boundaries, handoffs, memory behavior, and model-integrated features despite probabilistic outputs.

| Control | Required tests |
|---|---|
| Deterministic orchestration | Fixed-input tests for routing, expert selection, escalation, state transitions, retries, and termination limits |
| Structured outputs | Schema validation, missing/extra fields, malformed model output, and repair/fallback behavior |
| Tool authorization | Allow-list enforcement, argument validation, least privilege, confirmation gates, and denial of destructive or cross-tenant operations |
| Prompt and retrieval security | Prompt injection, indirect injection, data exfiltration, poisoned documents, unsafe links, and system-prompt disclosure attempts |
| Quality evaluation | Versioned golden datasets with task-specific pass criteria, regression thresholds, and human-reviewed samples |
| Reliability | Provider timeout, rate limit, malformed response, partial stream, model unavailability, fallback, and budget exhaustion |
| Auditability | Correlation of prompt/version metadata, tool calls, decisions, approvals, and outcomes without logging secrets or prohibited content |
| Drift control | Pin model and prompt versions for a release; rerun evaluation suites before changing either |

LLM output is not asserted by exact prose unless deterministic. Tests assert schemas, required facts, prohibited outcomes, tool effects, grounded citations where applicable, and bounded evaluation scores. No model-generated instruction may bypass production or Medium/High-risk human approval gates.

### 4.9 Security Testing

**Objective:** Identify vulnerabilities in source, dependencies, secrets, images, APIs, identity controls, agent tools, and infrastructure before release.

Adopt Semgrep for SAST, Dependabot plus ecosystem-native audit commands for SCA, Gitleaks for secrets, Trivy for images/filesystems, Checkov for infrastructure, and OWASP ZAP for authenticated DAST. Security tests cover OWASP Top 10, API Security Top 10, SSRF, injection, broken access control, tenant isolation, token handling, audit tampering, and abuse/rate limiting.

Independent manual penetration testing is required before the first production release, after material identity/trust-boundary changes, and at least annually. Critical findings block release; High findings require Security Engineer and product-owner disposition.

### 4.10 Performance, Capacity, and Scalability Testing

**Objective:** Measure latency, throughput, saturation, queue behavior, and cost/resource consumption at expected and peak demand.

k6 (**Adopt**) is the default load tool. Prometheus, Grafana, logs, and traces capture service and dependency behavior. Test profiles include baseline, load, stress, spike, and scalability. Workloads represent API traffic, Kafka throughput, agent concurrency, Temporal workflows, database/search operations, and portal journeys.

Release thresholds must be defined per critical journey. Until business SLAs are approved, a release candidate fails on errors above 1%, unexplained p95 latency regression above 10% against the accepted baseline, growing unprocessed queue depth after load ends, or exhausted resource limits. These provisional thresholds are not contractual SLAs.

### 4.11 Endurance, Resilience, and Recovery Testing

**Objective:** Detect memory, connection, handle, disk, queue, and latency degradation and prove recovery from dependency and infrastructure failures.

Major releases run a 48-72 hour soak in an isolated production-sized environment. Quarterly canary-environment tests cover long-running agents. Prometheus alerts track p95/p99 drift, memory and file descriptors, connection pools, queue lag, retries, dead letters, log volume, disk growth, and error rates.

Chaos Mesh or Litmus (**Adopt**) injects pod loss, broker/database interruption, latency, DNS failure, and resource pressure. Recovery tests validate retries, circuit breaking, idempotency, self-healing, backup restore, RTO/RPO, and operator remediation. Chaos experiments require an approved blast radius and must not target production without explicit human authorization.

### 4.12 Rolling Upgrade and Rollback Testing

**Objective:** Prove minimal-downtime N-1 to N upgrades, mixed-version compatibility, schema safety, state continuity, and automated non-production rollback.

Use Kubernetes rolling updates and Helm; adopt Argo Rollouts for canary analysis. Pact, `openapi-diff`, and schema compatibility checks gate mixed-version operation. Database changes follow the expand/migrate/contract pattern.

Every release candidate scripts these scenarios:

1. Run representative traffic while N-1 and N pods serve simultaneously; verify availability and error budgets.
2. Verify N-1 clients against N services and N clients against N-1 services where rollback requires it.
3. Apply migrations while both versions operate; verify reads, writes, reconciliation, and lock duration.
4. Kill pods and interrupt dependencies during rollout; verify no duplicate or lost committed work.
5. Preserve or safely resume sessions, Temporal workflows, Kafka processing, and in-flight agent tasks.
6. Trigger rollback on failed health or canary metrics and rerun smoke and integrity suites.
7. Confirm rollback does not require a destructive database downgrade.

Production rollout remains human-triggered and human-approved even when the same checks are automated in staging.

## 5. Test Environments and Data

| Environment | Purpose | Required suites |
|---|---|---|
| Local development | Fast feedback | Lint, unit, selected component and container smoke tests |
| CI ephemeral | Pull request and main-branch validation | Unit, build, SAST/SCA/secrets, image scan, API/service, contract, and migration tests |
| SIT | Integrated functional validation | Cross-service, event flow, external simulation, data/search, and regression suites |
| Staging | Production-representative release gate | System, GUI, accessibility, DAST, recovery, and rolling-upgrade rehearsal |
| Performance/soak | Isolated capacity validation | Load, stress, spike, scalability, chaos, and 48-72 hour soak |
| Production canary | Final controlled observation | Read-only or reversible smoke tests and telemetry assertions only |

Synthetic data is the default. Approved masked data may be used only when synthetic data cannot represent a defect, with documented authorization, minimization, retention, and deletion. Test data is tenant-labelled, reproducible, and cleaned after ephemeral runs. Production credentials and raw personal data are prohibited in local and CI environments.

## 6. CI and Release Gates

GitHub Actions is the target orchestrator because the repository has no current workflow. Protected environments enforce approvals and secret scopes. Jobs publish JUnit-compatible results, coverage, security reports, image digests, and logs as immutable build evidence.

| Trigger/stage | Tests | Gate |
|---|---|---|
| Pre-commit | Format/lint, type check, impacted fast unit tests, secrets check | Developer feedback; block commit where hooks are installed |
| Pull request | Full changed-component unit tests, coverage, SAST, SCA, secrets, build, image scan, API/service/contract tests | Block merge |
| Main branch | Full unit and integration suites, container structure, migrations, Compose/Kubernetes validation, smoke deployment | Block promotion to SIT |
| Nightly | System integration, full GUI/browser, accessibility, DAST, reconciliation, flaky-test detection | Failure creates a triaged defect; unresolved release blockers stop promotion |
| Release candidate | Full regression, performance baseline, recovery, rolling upgrade/rollback, security disposition | Implementation Manager go/no-go |
| Major release | 48-72 hour soak, capacity/stress, penetration-test status, restore rehearsal | Human release approval required |
| Production canary | Smoke and SLO telemetry only | Human-controlled continue or rollback decision |

CI must not deploy automatically to production. Medium and High-risk changes require explicit human review regardless of test outcome.

## 7. Entry, Exit, and Defect Criteria

### 7.1 Entry Criteria

- Approved requirement or defect with acceptance criteria and risk level.
- Testable build identified by commit and immutable image digest.
- Required environment, test identities, synthetic data, and dependency simulations are available.
- Relevant contracts, migrations, rollback plan, and observability are defined.
- No unresolved environment defect prevents meaningful execution.

### 7.2 Release Exit Criteria

- Required suites pass and evidence is retained against the release candidate.
- Coverage gates pass with no unexplained regression.
- No open Critical or High functional, security, data-integrity, or upgrade defect exists; accepted exceptions are signed and time-bound.
- Performance and reliability thresholds pass, including no unexplained degradation from the accepted baseline.
- Requirement traceability has no untested in-scope acceptance criterion.
- Rollback, restore, monitoring, and operator runbooks are rehearsed for material changes.
- Implementation Manager records go/no-go; required human production approval is present.

### 7.3 Defect Severity

| Severity | Definition | Release policy |
|---|---|---|
| Critical | Data loss/exposure, security compromise, system unavailable, unsafe autonomous action, or no viable recovery | Stop testing/promotion where necessary; release blocked |
| High | Critical workflow fails, tenant isolation breaks, major contract/regression, or upgrade/rollback is unsafe | Release blocked unless formally waived by required owners |
| Medium | Material degradation with workaround or non-critical requirement failure | Must be triaged with owner and target release |
| Low | Minor defect with limited operational or user impact | May be deferred with product-owner acceptance |

## 8. Traceability, Evidence, and Reporting

Use stable IDs for requirements (`REQ-*`), tasks (`TASK-*`), tests (`TEST-*`), defects (`DEFECT-*`), builds, and releases. The minimum chain is:

`Requirement -> acceptance criterion -> test case -> automated result/evidence -> defect -> fix commit -> release candidate`

Until a test-management product is selected, store the traceability matrix and test specifications in version control and publish CI evidence as build artifacts. Evaluate Xray or TestRail for case management and ReportPortal or Allure for cross-framework aggregation. Grafana remains the source for performance, soak, and rollout trends.

Weekly quality reporting includes pass/fail/block counts, requirement coverage, code coverage trend, escaped defects, flaky tests, security findings by age/severity, performance trend, and open exceptions. Metrics inform risk; they are not substitutes for acceptance criteria.

## 9. Roles and Accountability

| Role | Accountability |
|---|---|
| Developers | Unit/component tests, service tests, testability, static-analysis remediation, and local evidence |
| QA Engineer / Test Automation Engineer | API, contract, integration, system, GUI, regression, and framework maintenance |
| Test Manager | Strategy ownership support, traceability, scheduling, defect governance, and test sign-off recommendation |
| Performance Engineer | Workload model, capacity, performance, scalability, and soak evidence |
| Security Engineer | Security tooling policy, finding disposition, abuse tests, and penetration-test coordination |
| DevOps/SRE | CI runners, ephemeral environments, deployment/rollback, resilience experiments, and evidence retention |
| Product Owner | Acceptance criteria, business SLA approval, UAT, and risk acceptance |
| Implementation Manager | Strategy ownership and release go/no-go recommendation; confirms mandatory approvals |

## 10. Implementation Roadmap

1. Baseline all existing Python, Jest, Vitest, Temporal, smoke, and Selenium suites in one inventory with owners and commands.
2. Add a GitHub Actions pull-request workflow for lint, type checks, unit tests, coverage, secrets/SCA/SAST, image build, and Trivy scanning.
3. Establish OpenAPI/event contracts and add contract and migration compatibility gates.
4. Introduce Playwright and axe-core for new browser coverage while retaining Selenium until equivalent scenarios pass reliably.
5. Add Testcontainers-based service suites and a disposable SIT deployment with observable end-to-end assertions.
6. Approve business SLAs/SLOs, RTO/RPO, retention, browser matrix, and LLM evaluation thresholds.
7. Provision the isolated performance/soak environment and execute the first baseline, restore, and 48-hour soak.
8. Implement and rehearse N-1 to N rolling upgrade, failure-triggered rollback, and in-flight agent/workflow continuity.

## 11. Open Decisions

- Select the test-management and consolidated reporting products.
- Approve contractual p95/p99 latency, throughput, availability, error, and agent-quality thresholds.
- Approve RTO/RPO and maximum acceptable resource growth during soak tests.
- Define supported browser/device versions and accessibility audit cadence.
- Define supported N-1 version window and data-contract deprecation period.
- Select approved LLM evaluation datasets, judges, model versions, and change thresholds.

---

AISENA | Controlled Document | Do not distribute without approval