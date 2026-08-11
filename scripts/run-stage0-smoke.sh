#!/bin/sh
set -e

# Start detection consumer in background
python3 services/detection/consume.py > /tmp/detection.log 2>&1 &
DETECT_PID=$!

echo "Started detection (pid=$DETECT_PID), giving it 2s to connect..."
sleep 2

# Run producer to publish sample event
python3 services/ingestion/produce.py

# Wait for messages to be processed
sleep 3

echo "OpenSearch query results:"
curl -sS -X GET "http://localhost:9200/hsfs-stage0-screening-results/_search?size=5" | jq '.' || true

# Stop consumer
kill $DETECT_PID || true
sleep 1

echo "Logs from detection:"
tail -n 200 /tmp/detection.log || true
