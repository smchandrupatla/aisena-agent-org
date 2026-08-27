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

echo ""
echo "Publishing to Kafka via services/ingestion/produce.py ..."
python3 "$ROOT_DIR/services/ingestion/produce.py" --file "$EVENT_FILE" "$@"
