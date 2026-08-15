#!/bin/sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
EVENT_FILE="$ROOT_DIR/project/implementation/data/sample-event.json"

if [ ! -f "$EVENT_FILE" ]; then
  echo "Sample event file not found: $EVENT_FILE" >&2
  exit 1
fi

echo "Sample event payload:"
cat "$EVENT_FILE"

echo "\nStage 0 ingestion is currently a placeholder."
echo "Once runtime is available, this should publish the event to Kafka topic aisena-stage0-events."
