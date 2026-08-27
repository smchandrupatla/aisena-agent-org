#!/usr/bin/env bash
# Build the capabilities site, start Selenium Chrome, run HTML screen suite, tear down.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() {
  docker compose -f docker-compose.selenium.yml down -v || true
}
trap cleanup EXIT

docker compose -f docker-compose.selenium.yml up --build --abort-on-container-exit --exit-code-from gui-tests
