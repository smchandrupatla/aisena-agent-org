# HSFS Architecture Implementation

This package provides a reference implementation for the Hybrid Sanctions & Fraud Monitoring System architecture.

It includes:
- `components.py`: lightweight component classes for source systems, KYC, sanctions and PEP screening, risk enrichment, detection engines, alerting, case management, and governance.
- `runner.py`: a sample pipeline that exercises the components in order.

## Run the sample pipeline

```bash
python3 -c 'from services.hsfs_architecture import run_sample_pipeline; run_sample_pipeline()'
```
