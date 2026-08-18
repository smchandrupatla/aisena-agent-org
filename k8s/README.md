# AISENA — Kubernetes Manifests

Kustomize-based manifests to run the same stack as [`docker-compose.yml`](../docker-compose.yml)
on a Kubernetes cluster (Minikube locally, or any Kubernetes/EKS cluster).

## Layout

| File | Purpose |
|---|---|
| `00-namespace.yaml` | `aisena` namespace |
| `01-configmap.yaml` | Shared, non-secret env config + Prometheus scrape config |
| `02-secrets.yaml` | Dev-only placeholder credentials (replace before non-local use) |
| `10-postgres.yaml` | Postgres `StatefulSet` + headless `Service` + PVC |
| `11-zookeeper.yaml` | Zookeeper `Deployment` + `Service` |
| `12-kafka.yaml` | Kafka `StatefulSet` + headless `Service` + PVC |
| `13-opensearch.yaml` | OpenSearch `StatefulSet` + headless `Service` + PVC |
| `20-agent-manager.yaml` | Agent orchestration loop (`Deployment` + `Service`, metrics on `:9500`) |
| `21-api.yaml` | Flask REST API (`Deployment` + `Service`, `:5000`) |
| `22-detection.yaml` | Kafka consumer → Postgres/OpenSearch (`Deployment`, no exposed port) |
| `23-ingestion-job.yaml` | One-shot sample event publisher (`Job`) |
| `24-capabilities-site.yaml` | Frontend (`Deployment` + `Service`, `:3000`) |
| `30-grafana.yaml` / `31-prometheus.yaml` / `32-loki.yaml` | Observability stack |
| `33-redmine.yaml` / `34-apicurio.yaml` / `35-vault.yaml` | Supporting dev tools |
| `40-ingress.yaml` | Routes `aisena.local` → `capabilities-site` (`/`) and `api` (`/api`) |
| `kustomization.yaml` | Aggregates all resources; pins image tags |

## Prerequisites

- A running cluster: `minikube start` (local) or an existing EKS/GKE/AKS context.
- `kubectl` configured against that cluster.
- An ingress controller if you want `40-ingress.yaml` to work: `minikube addons enable ingress`.
- Docker (to build images) pointed at the cluster's daemon: `minikube -p minikube docker-env | Invoke-Expression` (PowerShell) so images don't need to be pushed to a registry.

## Build images

From the repo root (build context matters — several Dockerfiles read files outside their service folder):

```powershell
docker build -t aisena/agent-manager:latest -f Dockerfile.agent-manager .
docker build -t aisena/api:latest -f services/api/Dockerfile .
docker build -t aisena/ingestion:latest -f services/ingestion/Dockerfile .
docker build -t aisena/detection:latest -f services/detection/Dockerfile .
docker build -t aisena/capabilities-site:latest ./services/capabilities_site
```

## Deploy

```powershell
kubectl apply -k k8s/
kubectl -n aisena get pods -w
```

Or use [`../deploy_k8s.ps1`](../deploy_k8s.ps1) to do both steps against Minikube in one go.

## Access services

```powershell
kubectl -n aisena port-forward svc/capabilities-site 8081:3000
kubectl -n aisena port-forward svc/api 5000:5000
kubectl -n aisena port-forward svc/grafana 3000:3000
kubectl -n aisena port-forward svc/agent-manager 9500:9500
```

Or, with the ingress controller enabled and `aisena.local` mapped to `minikube ip` in your hosts file,
browse directly to `http://aisena.local/` and `http://aisena.local/api/...`.

## Trigger a screening run

```powershell
kubectl create job --from=job/ingestion ingestion-manual -n aisena
kubectl -n aisena logs -l job-name=ingestion-manual -f
kubectl -n aisena logs deployment/detection -f
```

## Notes / production hardening TODO

- `02-secrets.yaml` contains plaintext dev credentials — swap for Vault, Sealed Secrets, or
  the External Secrets Operator before using outside local dev.
- Grafana/Prometheus provisioning (dashboards/datasources) is not yet mounted from
  [`../infra/grafana`](../infra/grafana) / [`../infra/prometheus`](../infra/prometheus/prometheus.yml) — the
  Prometheus scrape config is inlined in `01-configmap.yaml` instead.
- Kafka/OpenSearch/Postgres run as single-replica `StatefulSets` with 2Gi PVCs — raise
  replica counts and storage classes for anything beyond local proofing.
