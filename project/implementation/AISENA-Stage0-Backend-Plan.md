# AISENA Stage 0 Backend Implementation Plan

## Overview
This plan describes the minimal backend implementation for the AISENA Stage 0 proof. The goal is to implement an ingestion path that publishes a toy event to Kafka, applies a simple sanctions screening match, and writes the result into OpenSearch.

## Goals
- Implement a simple event ingestor.
- Define the Kafka topic contract for `aisena-stage0-events`.
- Build a simple screening service that flags a toy blocked party.
- Write screening results to an OpenSearch index `aisena-stage0-screening-results`.
- Make the result queryable for QA validation.

## Components
### 1. Event Ingestor
- Reads sample JSON input.
- Validates required fields.
- Publishes the event to Kafka topic `aisena-stage0-events`.
- Uses a lightweight script or Java service stub.

### 2. Screening Service
- Consumes events from `aisena-stage0-events`.
- Applies a toy blocked-party match rule to `customerName`.
- Emits screening results with `FLAGGED` or `CLEAR`.
- Writes results to OpenSearch.

### 3. OpenSearch Result Writer
- Index name: `aisena-stage0-screening-results`.
- Document fields:
  - `transactionId`
  - `screeningStatus`
  - `matchReason`
  - `screeningTimestamp`
  - `sourceTopic`
  - `indexName`

## Technology Choices
- Minikube for local Kubernetes if available.
- Strimzi Kafka operator for the Kafka topic.
- OpenSearch via Helm.
- A simple backend implementation in shell script and/or Java stub.

## Validation
- Confirm the sample payload is published to Kafka.
- Confirm the screening service consumes the event.
- Confirm the OpenSearch index contains the flagged document.
- Use a simple validation script to query OpenSearch.

## Tasks
1. Create `project/implementation/AISENA-Stage0-Kafka-Contract.md`.
2. Add a simple sample payload under `project/implementation/data/sample-event.json`.
3. Create a lightweight ingest script under `scripts/aisena-stage0/`.
4. Create a lightweight screening service stub under `scripts/aisena-stage0/`.
5. Add validation documentation and query guidance.
6. Add a backend handoff to QA once the plan is complete.

## Notes
This plan is intentionally minimal and designed to be executable once runtime access is restored. It is not a full production implementation.
