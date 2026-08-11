#!/bin/sh
set -e

# Resolve repo root and use absolute service paths
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Start detection consumer in background
python3 "${REPO_ROOT}/services/detection/consume.py" > /tmp/detection.log 2>&1 &
DETECT_PID=$!

echo "Started detection (pid=$DETECT_PID), giving it 2s to connect..."
sleep 2

# Run producer to publish sample event
python3 "${REPO_ROOT}/services/ingestion/produce.py"

# Wait for messages to be processed and retry OpenSearch query until available
echo "Waiting for indexing to appear in OpenSearch..."
RETRIES=10
SLEEP=2
for i in $(seq 1 $RETRIES); do
	echo "Attempt $i/$RETRIES"
	curl -sS -X GET "http://localhost:9200/hsfs-stage0-screening-results/_search?size=5" | jq '.' > /tmp/opensearch_result.json || true
	if grep -q '"value"\s*:\s*[1-9]' /tmp/opensearch_result.json; then
		cat /tmp/opensearch_result.json
		break
	fi
	sleep $SLEEP
done

# Stop consumer
kill $DETECT_PID || true
sleep 1

echo "Logs from detection:"
tail -n 200 /tmp/detection.log || true
