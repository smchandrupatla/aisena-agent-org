# HSFS AI Agent Team — Roster, Job Descriptions & Delivery Approach

**Project:** Hybrid Sanctions and Fraud Screening System (HSFS)

**Prepared for:** Satish (Client / Product Sponsor)

## 1. Operating Model

The HSFS delivery organisation is structured around a single point of contact for the sponsor: the Implementation Manager.

- The sponsor provides problem statements, requirements, priorities, and feedback only to the Implementation Manager.
- The Implementation Manager creates, coordinates, and operates the AI agent organisation.
- Specialist agents are defined as versioned repo artifacts and invoked through an orchestration layer.
- Every stage of delivery must produce something runnable and testable, ensuring incremental progress.

### Organisation tiers

- **Tier 1 — Subject Matter Experts (SMEs):** Translate sponsor requirements into structured epics, stories, and implementation-level guidance.
- **Tier 2 — Delivery Team:** Plans, designs, builds, tests, secures, documents, and deploys the software.
- **Tier 3 — Sponsor:** Reviews outputs, approves direction, provides new requirements and feedback.

## 1a. Implementation Manager — Single Point of Contact

### Mission

Take client requirements and direction from Satish and turn them into a functioning, staffed, tooled AI agent organisation that can deliver HSFS incrementally.

### Core responsibilities

- Bootstrap the team by creating the initial agent role definitions and prompts.
- Provision repository structure, delivery tooling, and free/open-source infrastructure components as needed.
- Build the agent orchestration layer and handoff mechanism.
- Onboard each new agent with a detailed system prompt, repo artifact, and smoke test.
- Report status in plain language after each milestone.
- Escalate decisions requiring sponsor input or external credentials.

### What the Implementation Manager does NOT do

- Write HSFS business logic directly.
- Make architecture decisions unilaterally.
- Generate real-world account credentials, payment decisions, or secrets without sponsor approval.

### How agents are created

1. Define the role as a written prompt/spec.
2. Store the role definition as a versioned artifact under `/agents`.
3. Invoke the role through a Claude Code session or equivalent execution engine.
4. Wire handoffs with repo artifacts and shared document locations.
5. Validate with a trivial smoke test before declaring the role operational.

### Deliverables for the Implementation Manager

- Role prompt artifacts in `/agents`
- Handoff files in `/project/handoffs`
- Shared backlog and status reporting
- Project memory and readiness documentation
- Agent orchestration scripts or workflow triggers

## 2. Tier 1 — Subject Matter Expert Agents

Each SME researches their domain and authors implementation-ready epics, stories, and tasks.

1. **Sanctions Screening SME**
   - Expertise: OFAC SDN, 31 CFR, consolidated sanctions lists, fuzzy name matching
   - Produces: stories on match algorithms, list ingestion cadence, false-positive tuning rules

2. **Fraud Detection SME**
   - Expertise: transaction fraud typologies, risk scoring models, ML feature engineering
   - Produces: stories on fraud rules, scoring thresholds, model risk considerations

3. **Payments & Messaging SME (ISO 20022)**
   - Expertise: pacs.008/pacs.002, SWIFT MT/MX, NACHA formats, payment rail semantics
   - Produces: stories on message parsing, field mapping, SLA rules

4. **Regulatory & Compliance SME**
   - Expertise: BSA/AML, FFIEC exam manual, Wolfsberg guidance, SR 11-7
   - Produces: stories on control requirements, audit trail needs, model governance

5. **Data Architecture & Database SME**
   - Expertise: schema design, Iceberg/Parquet, data lake modeling, normalization
   - Produces: stories on data models, retention, partitioning strategy

6. **Search & OpenSearch SME**
   - Expertise: index design, relevance tuning, fuzzy/phonetic matching at scale
   - Produces: stories on index mappings, query performance, latency targets

7. **Streaming & Messaging Infra SME**
   - Expertise: Kafka KRaft, partitioning, Flink/Spark streaming semantics
   - Produces: stories on topic design, exactly-once processing, backpressure handling

8. **Cloud & AWS SME**
   - Expertise: EKS, MSK, OpenSearch Service, IAM, cost optimization
   - Produces: stories on environment provisioning, scaling policy, cost guardrails

9. **Security & Identity SME**
   - Expertise: Keycloak, OpenBao, mTLS, secrets management, zero-trust
   - Produces: stories on auth flows, secret rotation, network policy

10. **Case Management & UX SME**
    - Expertise: analyst workflows, alert triage, case lifecycle best practice
    - Produces: stories on GUI workflows, alert queues, disposition tracking

### SME common responsibilities

- Research current best practice, open-source options, and regulatory expectations.
- Convert sponsor direction into epics → stories → tasks with SMART acceptance criteria.
- Provide concrete implementation guidance.
- Flag domain and regulatory risk early.

## 3. Tier 2 — Delivery Team Agents

1. **Product Owner**
   - Owns and grooms the backlog.
   - Sequences SME-authored work into buildable increments.

2. **Solution Architect**
   - Owns overall technical design.
   - Ensures each increment fits the architecture and resolves cross-cutting decisions.

3. **Infrastructure/Platform Engineer**
   - Builds Kubernetes/Minikube/EKS environments, Helm charts, networking, and cluster services.

4. **Backend Developer — Ingestion & Streaming**
   - Builds parsers, Kafka producers/consumers, and streaming jobs.

5. **Backend Developer — Detection Services**
   - Builds sanctions screening and fraud scoring services, initially stubbed.

6. **Backend Developer — Data & Persistence**
   - Builds PostgreSQL schema, Iceberg/Trino data lake layer, and shared data APIs.

7. **Frontend/GUI Developer**
   - Builds the dashboard for screening results, alerts, and case review.

8. **DevOps / Release Engineer**
   - Owns CI/CD, branching strategy, build/deploy pipelines, and release automation.

9. **QA / Test Automation Engineer**
   - Writes automated test suites and owns regression coverage.

10. **Performance & Endurance Test Engineer**
    - Owns load, performance, and soak testing with k6.

11. **Test Manager**
    - Owns overall test strategy and signs off releases as test-complete.

12. **Security & Compliance Engineer**
    - Runs security screening, dependency checks, and compliance reviews.

13. **Technical Writer**
    - Produces design docs, runbooks, release notes, and user-facing guides.

14. **Release Manager**
    - Coordinates handoffs, tracks shippable increments, and reports status to the sponsor.

### Handoff flow

Sponsor requirement → SME authoring → Product Owner backlog grooming → Solution Architect validation → Development → QA/Test Manager validation → Security/Compliance review → Documentation parallelization → Release Manager packaging → Sponsor review.

## 4. What’s Needed to Actually Run This

### Practical constraints

- Claude cannot autonomously run infrastructure or background jobs without an execution mechanism.
- Each agent is realized as a focused prompt-driven session, invoked through a command or workflow.
- Build the orchestration layer first so the handoff chain is reproducible.

### Required tooling and infrastructure

| Need | Free / low-cost option | Purpose |
|---|---|---|
| Source control + CI | GitHub + GitHub Actions | repo and pipeline hosting |
| Local Kubernetes | Minikube | local cluster for service orchestration |
| Container registry | GitHub Container Registry / Docker Hub | container images |
| Messaging | Strimzi Kafka on Minikube | event streaming |
| Search | OpenSearch | indexing and search |
| GitOps | ArgoCD | deployment automation |
| Database | PostgreSQL | relational and metadata storage |
| Data lake | Apache Iceberg + MinIO + Trino | analytical storage and queries |
| Observability | Grafana + Loki or OpenSearch Dashboards | logs and telemetry |
| Work management | Redmine / GLPI | case and workflow tracking |
| Test automation | JUnit + REST Assured + Karate + k6 | functional and performance testing |
| Secrets | OpenBao | secrets management |
| Schema registry | Apicurio Registry | message contract registry |

### Notes
- Free-tier cloud is useful later, but Minikube is the lowest-friction way to prove the system locally.
- AWS should only be introduced when Stage 5 is explicitly authorized.

## 5. Staged Incremental Delivery Approach

### Stage 0 — Team Pipeline Proof

Deliver a trivial end-to-end proof using the full agent handoff chain and a runnable toy flow.

### Stage 1 — Minimal Ingestion + Search

Deliver a containerized feed parser running on Minikube, pushing events into Kafka and indexing them into OpenSearch with a basic UI.

### Stage 2 — Stubbed Sanctions + Fraud Screening

Add stub detection services and make screening results visible through the shared layer.

### Stage 3 — Case Management Basics

Add alert-to-case workflow, disposition tracking, and audit trail support.

### Stage 4 — Security & Compliance Hardening

Add auth, secrets management, audit logging, and BSA/AML/NIST-aligned controls.

### Stage 5 — Cloud Portability

Deploy the same Helm charts to AWS EKS/MSK/OpenSearch Service and prove the Minikube→cloud path.

## 6. Immediate Next Step

Stand up the Implementation Manager first in a new GitHub repo or this existing repo. It should:

- Create the Product Owner, Solution Architect, one Developer, QA, and Release Manager roles.
- Create at least one SME.
- Run a trivial Stage 0 task through the full handoff chain.
- Tell the sponsor exactly what exists, what can be run, and what decision is needed next.
