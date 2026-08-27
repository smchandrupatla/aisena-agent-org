#!/bin/sh
set -e

OPENSEARCH_URL="${OPENSEARCH_URL:-http://localhost:9200}"
INDEX="aisena-stage0-screening-results"

echo "Querying ${OPENSEARCH_URL}/${INDEX} for screening results..."
RESULT=$(curl -sS -X GET "${OPENSEARCH_URL}/${INDEX}/_search?size=5")
echo "$RESULT"

MATCHES=$(echo "$RESULT" | grep -o '"value"[[:space:]]*:[[:space:]]*[1-9]' || true)
if [ -z "$MATCHES" ]; then
  echo "No screening results found yet in ${INDEX}." >&2
  exit 1
fi

echo "Found flagged/screened result(s) in ${INDEX}."
