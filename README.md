# AISENA — Domain-Agnostic AI Agent Organization

[![CI](https://github.com/smchandrupatla/aisena-agent-org/actions/workflows/ci.yml/badge.svg)](https://github.com/smchandrupatla/aisena-agent-org/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/smchandrupatla/aisena-agent-org?style=social)](https://github.com/smchandrupatla/aisena-agent-org/stargazers)

**AISENA** is a domain-agnostic AI implementation system for building software delivery organizations, product teams, and implementation workflows across any business domain.

It is not limited to a single vertical. The same architecture can be applied to compliance, operations, healthcare, logistics, retail, SaaS, internal tooling, or risk and fraud programs. The repository includes an example implementation pattern and a staged agent operating model, designed to be reusable beyond any one domain.

---

## Features

- **Multi-agent operating model** — staged agent roster for delivery, orchestration, and domain work
- **Docker Compose & Kubernetes** — local development and cluster-ready deployment
- **Observability stack** — Prometheus, Grafana, Loki (plus enterprise paths for Splunk / Dynatrace)
- **Event-driven backend** — schemas, orchestrator, API, and supporting services
- **Web portal & CRM-style surfaces** — for interaction and case/work management
- **Benchmarks & samples** — see related `sand-bench` and `samples/` for evaluation patterns

---

## Architecture

| Document | Description |
|----------|-------------|
| [AISENA AI Agent Team](project/architecture/AISENA-AI-Agent-Team.md) | Agent roster, delivery approach, and operating model |
| [Stage 0 Architecture](project/architecture/AISENA-Stage0-Architecture.md) | Bootstrap architecture |
| [Stage 0 Orchestration](project/architecture/AISENA-Stage0-Orchestration.md) | Orchestration patterns |
| [Agent operating model](project/architecture/agent-operating-model.md) | How agents collaborate |
| [Enterprise observability](docs/ENTERPRISE_OBSERVABILITY.md) | OpenTelemetry gateway (Splunk / Dynatrace) |

---

## Quick start

### Prerequisites

- Docker & Docker Compose
- (Optional) Kubernetes / Minikube for cluster deploy
- Python 3.12+ and Node.js 20+ if running services outside containers

### Local development (Docker Compose)

```bash
# From repository root
docker compose -f docker-compose.yml up -d

# Or use the helper script (Windows PowerShell)
./deploy_aiena.ps1
```

Infra-only stack (Postgres, Kafka, OpenSearch, Grafana, Prometheus, Loki, Redmine, Vault, etc.):

```bash
cd infra
docker compose up -d
```

See [README-STATUS.md](README-STATUS.md) for ports and credentials (local-dev only).

### Kubernetes

```bash
# See k8s/README.md or:
./deploy_k8s.ps1
```

---

## Repository layout

```
aisena-agent-org/
├── agents/           # Agent definitions and related assets
├── backend/          # Backend services and schemas
├── docs/             # Documentation (observability, etc.)
├── infra/            # Local infra compose (DB, Kafka, observability)
├── k8s/              # Kubernetes manifests
├── modules/          # Shared modules
├── project/          # Architecture and project docs
├── samples/          # Example workflows / demos
├── scripts/          # Utility and maintenance scripts
├── services/         # API, orchestrator, CRM portal, etc.
├── tests/            # Feature-health regression suite
├── webportal/        # Web portal frontend
├── docker-compose.yml
└── README.md
```

---

## CI / regression

Continuous Integration runs on **every push to `main` and every pull request**:

- Python unit tests (API, orchestrator, eventing, agent scripts)
- **Feature-health regression suite** (`tests/test_feature_health.py`) — validates structure, API pure logic, eventing, orchestrator modules, compose services, and health-check utilities
- CRM portal tests and production build
- Event schema validation
- Docker Compose config validation

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

### Run the feature-health suite locally

```bash
# Install API deps (Flask, etc.)
pip install -r services/api/requirements.txt -r services/orchestrator/requirements.txt

# From repository root
python -m unittest tests.test_feature_health -v
```

---

## Configuration

Copy the example env file and adjust for your environment:

```bash
cp .env.example .env
```

Secrets for production should use your preferred vault (local stack uses Vault in dev mode; see infra docs).

---

## Contributing

1. Fork the repository (or work on a branch if you have write access).
2. Create a feature branch: `git checkout -b feature/your-change`.
3. Make changes and ensure CI passes locally where possible.
4. Open a pull request against `main`.

Issues and discussions are welcome for bugs, ideas, and architecture feedback.

---

## Related projects

- **sand-bench** — Benchmark and testing platform for AISENA agent performance
- **IntelliSFG** — AI-powered transaction intelligence and fraud protection (private)
- **risk-rules-engine-wiki** — Offline architecture wiki for risk / sanctions / fraud rules

---

## License

This project is licensed under the [MIT License](LICENSE).
