# HSFS Kubernetes Stubs

These manifests are production deployment stubs for the independently deployable HSFS backend. They do not modify or join the existing AISENA portal deployment.

The base deploys the six services, Temporal worker, and workflow API. Kafka, PostgreSQL, Redis, and Temporal are assumed to be managed platform dependencies; update `01-config.yaml` with environment-specific DNS names.

Before deployment:

1. Replace the placeholder `hsfs-secrets` values using the platform secret manager.
2. Publish all `aisena/hsfs-*` images and pin immutable tags or digests.
3. Add NetworkPolicies, PodDisruptionBudgets, autoscaling, ingress, TLS, and workload identity.
4. Point PostgreSQL-backed services at service-owned databases and credentials.
5. Add OpenTelemetry sidecar or SDK configuration required by the target platform.

Render the stubs without applying them:

```bash
kubectl kustomize backend/k8s
```

These are intentionally non-production-ready per the current pass's non-goal.
