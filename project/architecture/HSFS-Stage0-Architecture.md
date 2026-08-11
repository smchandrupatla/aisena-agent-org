# HSFS Stage 0 Architecture

## Purpose
Define the minimal architecture for the HSFS Stage 0 proof-of-concept and establish component responsibilities for a runnable toy screening flow.

## Architecture Overview
Stage 0 is intentionally lightweight. It proves the agent delivery chain using a sample event ingestion path that reaches Kafka, passes through a simple screening service, and stores results in OpenSearch.

### Components
- `Stage0 Ingestor`
  - Reads a sample JSON event and publishes it to Kafka.
  - Responsible for validating the toy event schema and creating the source topic.

- `Stage0 Screening Service`
  - Consumes events from Kafka.
  - Applies a simple sanctions screening rule against a toy blocked party list.
  - Produces screening results to an OpenSearch index.

- `Kafka Cluster`
  - Uses Strimzi on Minikube for local event streaming.
  - Contains one topic: `hsfs-stage0-events`.

- `OpenSearch`
  - Stores screening result documents in an index: `hsfs-stage0-screening-results`.
  - Provides a retrieval path for validation.

- `Stage0 Validation`
  - A simple check that verifies the OpenSearch document exists and contains the expected screening status.

## Minimal Data Flow
1. Sample input is submitted to the Stage0 Ingestor.
2. The event is published to `hsfs-stage0-events`.
3. The Stage0 Screening Service consumes the event.
4. The screening service flags the event if it matches a toy blocked party.
5. The result is written to OpenSearch.
6. Validation confirms the flagged document exists.

## Interface Contracts
- `hsfs-stage0-events` Kafka topic message:
  - `transactionId`, `customerName`, `customerCountry`, `amount`, `currency`, `purpose`, `referenceId`
- OpenSearch result document fields:
  - `transactionId`, `screeningStatus`, `matchReason`, `screeningTimestamp`, `sourceTopic`, `indexName`

## Stage 0 Constraints
- No production-grade sanctions engine.
- No user-facing GUI required for the proof; API or search validation is sufficient.
- No PostgreSQL or permanent data lake required at this stage.
- Use a toy blocked party list stored locally in the screening service.

## Runbook Notes
- This stage is designed for a local Minikube environment.
- If runtime automation is not available, the architecture is the executable plan for future implementation.
- The next step is implementation by the Backend Engineer and validation by QA.
