#!/bin/sh
set -e
cd "$(dirname "$0")/../../"
./scripts/agents/run-agent.sh 06-database-engineer
