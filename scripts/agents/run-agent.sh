#!/bin/sh
set -e

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <agent-id>"
  echo "Example: $0 00-implementation-manager"
  exit 1
fi

AGENT_DIR="agents/$1"
PROMPT_FILE="$AGENT_DIR/AGENT.md"

if [ ! -d "$AGENT_DIR" ]; then
  echo "Agent directory not found: $AGENT_DIR"
  exit 2
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Agent prompt file not found: $PROMPT_FILE"
  exit 3
fi

COPILOT_BIN="$(command -v copilot || true)"
if [ -z "$COPILOT_BIN" ]; then
  echo "Copilot CLI not found in PATH. Please install or configure it." >&2
  exit 4
fi

echo "Running agent $1 using Copilot CLI..."
"$COPILOT_BIN" -p "$(cat "$PROMPT_FILE")" --allow-all --allow-all-paths --allow-all-tools --output-format text
