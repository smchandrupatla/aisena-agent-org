# HSFS — README-STATUS

This file describes the local development infra composed via `infra/docker-compose.yml`.

Planned services (docker-compose):

- PostgreSQL
  - Image: `postgres:15`
  - Port: `5432`
  - Credentials: `hsfs` / `hsfs_pw` (user/password), DB: `hsfs`

- Apache Kafka (docker-compose via Bitnami Kafka + Zookeeper)
  - Zookeeper port: `2181`
  - Kafka broker port: `9092`
  - Notes: single-node, plaintext for local development

- OpenSearch (single-node)
  - Image: `opensearchproject/opensearch`
  - Port: `9200`
  - Security: disabled for local dev

- Grafana
  - Port: `3000`
  - Admin password: `admin`

- Prometheus
  - Port: `9090`
  - Config: `infra/prometheus/prometheus.yml`

- Loki
  - Port: `3100`

- Redmine (ticketing / case management)
  - Port: `3001` (Rails app served on 3000 inside container)
  - DB: uses the PostgreSQL service above

- Apicurio Registry (in-memory)
  - Port: `8080`

- Vault (development mode) — used as a local secrets manager in place of OpenBao
  - Port: `8200`
  - Root token: `root`
  - NOTE: This is Vault dev mode, not suitable for production.

How to start the stack (from the repo root):

```bash
cd infra
docker compose up -d
```

Check service logs or health with:

```bash
docker compose ps
docker compose logs -f <service-name>
```

Access UIs:

- PostgreSQL: connect to `localhost:5432` (use a DB client)
- Kafka: `localhost:9092` (use Kafka client or Kafkacat)
- OpenSearch: http://localhost:9200
- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100
- Redmine: http://localhost:3001
- Apicurio Registry: http://localhost:8080/apis/registry/v2
- Vault: http://localhost:8200 (token: `root`)

Notes and caveats:

- This Codespace may not allow running Docker-in-Docker or privileged containers required by some images; if `docker compose up` fails, consider:
  - Running the stack in a local machine with Docker Desktop.
  - Replacing Kafka/Opensearch with lightweight managed dev services or test containers.

- `OpenBao` binary/service was not available as an officially supported container in this stack; Vault is provided as a local secrets manager alternative. If you require `OpenBao`, I can attempt to add it next (requires locating a container or build instructions).

- All services are configured for local development only. Credentials and defaults are insecure by design for convenience; do not use them in production.
