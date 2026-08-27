#!/bin/sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Starting Stage 0 screening/detection service..."
echo "Consuming from Kafka topic \${KAFKA_TOPIC:-aisena-stage0-events}, applying the toy amount>1000 rule, and writing results to Postgres + OpenSearch."
exec python3 "$ROOT_DIR/services/detection/consume.py"
