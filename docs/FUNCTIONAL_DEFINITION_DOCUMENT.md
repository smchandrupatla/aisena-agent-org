# AISENA — Functional Definition Document (FDD)

**Wiki-style functional specification** of the domain-agnostic AI agent organization.

> Companion to the web portal page: `services/capabilities_site/fdd.html` (nav label **FDD**).

---

## 1. Executive Summary & Mission

**AISENA** is a domain-agnostic AI implementation system for building software delivery organizations, product teams, and implementation workflows across any business domain.

It is a **staffed, tooled, governed AI agent organisation** that turns sponsor goals into planned, coded, tested, documented, and releasable software with minimal hand-holding.

The same architecture applies to compliance, operations, healthcare, logistics, retail, SaaS, internal tooling, or risk and fraud programs. Example risk/compliance flows in the repo are demonstrations, not constraints.

---

## 2. What AISENA Is (True Sense)

AISENA is an **autonomous delivery shop** of specialised AI agents that collaborate through versioned artifacts, handoff protocols, and orchestration. The sponsor interacts primarily with the **Implementation Manager**.

### Not
- A generic multi-agent chat framework without delivery discipline
- Locked to one vertical
- A black-box that silently changes production
- A substitute for human accountability on legal, financial, or production decisions

### Does
- Translates goals into requirements, architecture, and buildable increments
- Runs definition, engineering, platform, assurance, and completion in parallel where contracts allow
- Produces runnable, testable artifacts every stage
- Maintains append-only logs, handoffs, and status reports
- Exposes a web portal for ops, tasks, issues, agent chat, and documentation

---

## 3. Value Proposition

**Turn product goals into running software with minimal hand-holding.**

| Pillar | Meaning |
|--------|---------|
| Domain-agnostic | Reuse roster, governance, and deploy patterns across verticals |
| Bounded autonomy | Free on implementation detail; humans gate production, spend, data, pricing, legal |
| Evidence over claims | Backlog, docs, tests, handoffs, runnable artifacts |
| Local-first, cloud-ready | Compose/Minikube proof → K8s/EKS when authorised |
| Observable by default | Prometheus, Grafana, Loki + Splunk/Dynatrace paths |
| Operator portal | Tasks, issues, chat, viewers, templates |

**Stakeholder one-liner:** *AISENA is a reusable AI agent organisation that delivers software the way a high-discipline product team would — with specialists, handoffs, gates, and proof — without being locked to any single industry.*

---

## 4. Capabilities

- Discovery & product framing  
- Architecture & design (ADRs, APIs, UX)  
- Engineering (FE/BE/data/integration/streaming)  
- Platform & DevOps (Compose, K8s, CI/CD, secrets)  
- QA (feature-health, Selenium, k6)  
- Security & compliance gates  
- Observability (metrics/logs/traces)  
- Case/work management surfaces  
- SDLC documentation templates  
- Agent learning, roster, and chat console  

---

## 5. Agent Operating Model

```
Sponsor → Implementation Manager → SMEs / Definition / Engineering / Platform & QA → Docs & Release
```

- **Tier 1 — SMEs:** domain epics and stories  
- **Tier 2 — Delivery:** PO, Architect, engineers, DevOps, QA, Security, Writer, Release  
- **Tier 3 — Sponsor:** review and direction  

Handoffs: `/project/handoffs/<task-id>-<from>-to-<to>.md`  
Status: `/project/reports/IMPLEMENTATION_STATUS.md`  
Change log: append-only agent operations log  

---

## 6. Architecture (Stage 0 proof)

```
Sample Event → Stage0 Ingestor → Kafka (aisena-stage0-events)
    → Stage0 Screening Service → OpenSearch (aisena-stage0-screening-results)
    → Validation
```

Broader stack: Kafka, ingestion/detection/agent-manager/API/orchestrator, PostgreSQL, OpenSearch, capabilities site, Prometheus/Grafana/Loki, Redmine, Vault, Apicurio.

---

## 7. Staged Roadmap

| Stage | Focus |
|-------|--------|
| 0 | Team pipeline + toy screening flow |
| 1 | Ingestion + search on Minikube |
| 2 | Stubbed sanctions/fraud screening |
| 3 | Case management basics |
| 4 | Security & compliance hardening |
| 5 | Cloud portability (EKS/MSK/OpenSearch) |

---

## 8. Web Portal

Primary surface: `services/capabilities_site` — Overview, Capabilities, Wiki, **FDD**, Create New App, Tasks, Issues, dashboards, Postgres/Kafka/Splunk/Dynatrace viewers, Agent Learning, Workflow, Guardrails, Manage Agents, Agents + Chat, Documentation, AI Cheatsheet.

---

## 9. Governance

Human approval required for production, real spend, user-data handling, pricing, and legal/regulatory exposure. Append-only logs, critic reviews, CI on every push/PR.

---

## 10. Deployment

```bash
docker compose -f docker-compose.yml up -d
# Capabilities site typically http://localhost:8081
```

---

## 11. Functional Requirements (summary)

| ID | Requirement |
|----|-------------|
| FR-01 | Single Implementation Manager contact |
| FR-02 | Versioned agent roles under `/agents` |
| FR-03 | Handoff artifacts for transitions |
| FR-04 | Runnable Stage 0 event path |
| FR-05 | Web portal with ops and wiki surfaces |
| FR-06 | Observability + enterprise export path |
| FR-07 | CI including feature-health and GUI screens |
| FR-08 | Approval gates for high-impact actions |
| FR-09 | Domain-agnostic Create New App intake |
| FR-10 | SDLC documentation templates |

---

## 12. Glossary

- **FDD** — Functional Definition Document  
- **Implementation Manager** — sole routine sponsor contact / orchestrator  
- **SME** — Subject Matter Expert agent  
- **Bounded autonomy** — agents free on detail; humans gate high impact  
- **Capabilities site** — primary web portal  

---

*Licensed under the project MIT license. See repository `project/architecture/` for detailed ADRs and team roster.*
