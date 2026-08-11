#!/bin/sh
# Start the agent manager in background
DIR="$(cd "$(dirname "$0")/.." && pwd)"
python3 "${DIR}/agents/manager/agent_manager.py" > /tmp/agent_manager.log 2>&1 &
echo $!
