# AISENA Architecture Implementation

This package provides a reference implementation for the AISENA domain-agnostic implementation system.

It demonstrates how a multi-stage event-driven system can be assembled from reusable building blocks such as source systems, enrichment services, detection engines, workflow orchestration, case management, observability, and governance layers. The example code models a risk/compliance-inspired flow, but the structure is intentionally reusable for other domains.

It includes:
- `components.py`: lightweight component classes for source systems, enrichment stages, detection logic, workflow orchestration, alerting, case management, and governance.
- `runner.py`: a sample pipeline that exercises the components in order.

## Run the sample pipeline

```bash
python3 -c 'from services.aisena_architecture import run_sample_pipeline; run_sample_pipeline()'
```
