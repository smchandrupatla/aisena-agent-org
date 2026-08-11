# REQ-0004 — HSFS Stage 0 Sanctions Screening Story

Status: DRAFT

## Purpose
Define a minimal, runnable HSFS Stage 0 story that proves the agent delivery pipeline using a toy sanctions screening flow.

## Story
As a sanctions analyst, I want a single sample transaction event to be ingested, screened against a toy sanctions reference match, and indexed for inspection, so that the delivery team can prove the end-to-end pipeline without building full production rules.

## Scope
- One sample JSON input representing a transaction or entity to be screened.
- A minimal ingestion component that publishes the event to a Kafka topic.
- A simple screening service that flags a known blocked entity with a basic match rule.
- Index the screening result into OpenSearch.
- Provide a simple retrieval path for query or dashboard validation.

## Sample Input
```json
{
  "transactionId": "TX-0001",
  "customerName": "Acme Global Industries",
  "customerCountry": "US",
  "amount": 12500.00,
  "currency": "USD",
  "purpose": "International supplier payment",
  "referenceId": "REF-12345"
}
```

## Screening Rules
- If `customerName` fuzzy-matches a blocked party like `ACME GLOBAL` or `ACME GLOBAL INDUSTRIES`, the event should be flagged as a sanctions hit.
- The rule may be implemented as a simple substring/fuzzy check for Stage 0.
- The output should include a `screeningStatus` and a `matchReason`.

## Expected Output
```json
{
  "transactionId": "TX-0001",
  "screeningStatus": "FLAGGED",
  "matchReason": "Customer name matches toy blocked party ACME GLOBAL",
  "screeningTimestamp": "<ISO8601>",
  "sourceTopic": "hsfs-stage0-events",
  "indexName": "hsfs-stage0-screening-results"
}
```

## Acceptance Criteria
- A Stage 0 requirement document exists and is stored under `/project/requirements`.
- A simple sample input and expected output are defined.
- The screening story references a minimal Kafka topic and OpenSearch index.
- The story can be implemented as a proof-of-concept using the existing project structure.
- The story is handed off to the Solution Architect and Backend Engineer.

## Notes
This story is intentionally minimal and designed to prove the agent handoff chain rather than deliver a production-grade sanctions engine.
