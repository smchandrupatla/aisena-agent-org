#!/bin/sh
set -e
cd "$(dirname "$0")/../../"
./scripts/agents/run-agent.sh 13-release-manager
