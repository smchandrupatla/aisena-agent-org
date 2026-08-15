#!/bin/sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Stage 0 screening service placeholder"
echo "This script should consume messages from Kafka topic aisena-stage0-events, apply the toy screening rule, and write results to OpenSearch."

echo "If customerName contains 'Acme Global', the message should be flagged."
