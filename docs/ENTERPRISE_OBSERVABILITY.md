# Enterprise Log Export

AISENA runs Splunk Enterprise locally and uses the OpenTelemetry Collector as a
vendor-neutral log gateway. Docker's Fluent Forward logging driver sends
application stdout and stderr to the gateway on port 24224. The gateway adds
AISENA resource attributes, batches the records, and sends each record to local
Splunk and Dynatrace SaaS, without vendor SDKs in application code.

## Configuration

Copy `.env.example` to `.env` and provide these values:

| Variable | Purpose |
|---|---|
| `DEPLOYMENT_ENVIRONMENT` | Environment attached to every log record |
| `SPLUNK_PASSWORD` | Local Splunk administrator password |
| `SPLUNK_HEC_ENDPOINT` | Splunk HEC base URL ending in `/services/collector` |
| `SPLUNK_HEC_TOKEN` | Enabled HEC token allowed to write to the target index |
| `SPLUNK_HEC_INDEX` | Splunk destination index; defaults to `main` |
| `SPLUNK_HEC_TLS_INSECURE` | Accept local Splunk's self-signed certificate; use `false` with a trusted certificate |
| `DYNATRACE_OTLP_ENDPOINT` | Dynatrace OTLP base URL ending in `/api/v2/otlp` |
| `DYNATRACE_API_TOKEN` | Dynatrace token with the `logs.ingest` scope |

Do not commit `.env` or vendor tokens. Use a secrets manager outside local
development and rotate either token if it is exposed.

Generate a local HEC token value with `[guid]::NewGuid()` in PowerShell. Use a
strong `SPLUNK_PASSWORD`; the Splunk container rejects weak or empty passwords.
The HEC token's allowed-index list and default index must include the value of
`SPLUNK_HEC_INDEX`; otherwise Splunk can accept requests without routing them to
the intended searchable index.

## Start

Splunk and the gateway are profile-gated because they cannot start usefully
without the local password, shared HEC token, and Dynatrace tenant credentials.

```powershell
docker compose --profile enterprise-observability up -d enterprise-log-gateway
```

The gateway depends on Splunk, so this command starts both modules. Splunk can
take several minutes to initialize on its first run. Compose waits for Splunk's
health check before starting the gateway, preventing HEC startup-time log loss.

Starting the complete stack with the same profile also enables the gateway:

```powershell
docker compose --profile enterprise-observability up -d
```

Application containers must be recreated after enabling the gateway so Docker
applies the Fluent Forward logging driver. Splunk Web is available at
`http://localhost:8000` with username `admin`; HEC listens on
`https://localhost:8088`. The collector health endpoint is available at
`http://localhost:13133/`.

## Verify

```powershell
Invoke-WebRequest http://localhost:13133/
curl.exe -k https://localhost:8088/services/collector/health
docker compose logs enterprise-log-gateway
```

Send a uniquely tagged test record through the same Docker logging path used by
the applications:

```powershell
docker run --rm `
	--log-driver=fluentd `
	--log-opt fluentd-address=localhost:24224 `
	--log-opt fluentd-async=true `
	--log-opt tag=aisena.test `
	alpine:3.20 echo AISENA_OBSERVABILITY_TEST
```

Generate an application request or event, then query for
`service.namespace="aisena"` and `deployment.environment="local"` in each
vendor. Export failures remain visible in the gateway container logs and are
retried by the collector without a maximum elapsed time. The local Splunk
export timeout is 30 seconds to tolerate first-run indexing latency.

The pipeline is defined in `infra/otel-collector-config.yaml`. For non-local
Splunk deployments, change `SPLUNK_HEC_ENDPOINT`, install a trusted certificate,
and set `SPLUNK_HEC_TLS_INSECURE=false`.