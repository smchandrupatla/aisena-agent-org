# AISENA — Domain-Agnostic Implementation System

This repository bootstraps a domain-agnostic AI implementation system for building software delivery organizations, product teams, and implementation workflows across any business domain.

AISENA is not limited to a single vertical or use case. The same architecture can be applied to compliance, operations, healthcare, logistics, retail, SaaS, internal tooling, or risk and fraud programs. The repository includes an example implementation pattern and a staged agent operating model, but the system is intentionally designed to be reusable beyond any one domain.

See `/project/architecture/AISENA-AI-Agent-Team.md` for the proposed AISENA agent roster, delivery approach, and operating model.

## Deployment

- **Docker Compose** (local dev): `docker compose up -d`, or run [`deploy_aiena.ps1`](deploy_aiena.ps1).
- **Kubernetes** (Minikube or any cluster): see [`k8s/README.md`](k8s/README.md), or run [`deploy_k8s.ps1`](deploy_k8s.ps1).

## Observability

- **Local stack**: Prometheus, Grafana, and Loki are included in the default Compose deployment.
- **Splunk and Dynatrace logs**: see [`docs/ENTERPRISE_OBSERVABILITY.md`](docs/ENTERPRISE_OBSERVABILITY.md) for the credential-gated OpenTelemetry gateway.

