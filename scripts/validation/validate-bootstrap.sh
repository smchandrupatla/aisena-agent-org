#!/bin/sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

required_files="
agents/00-implementation-manager/AGENT.md
agents/00-implementation-manager/RESPONSIBILITIES.md
agents/00-implementation-manager/INPUTS.md
agents/00-implementation-manager/OUTPUTS.md
agents/00-implementation-manager/CHECKLIST.md
project/backlog/BACKLOG.md
project/PROJECT_STATE.md
project/risks/RISK_REGISTER.md
project/reports/IMPLEMENTATION_STATUS.md
project/reports/bootstrap-assessment.md
project/architecture/agent-operating-model.md
scripts/agents/run-agent.sh
scripts/bootstrap/bootstrap.sh
scripts/validation/validate-bootstrap.sh
"

missing=0
for file in $required_files; do
  if [ ! -f "$ROOT_DIR/$file" ]; then
    echo "MISSING: $file"
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Bootstrap validation failed."
  exit 1
fi

echo "Bootstrap validation passed."
