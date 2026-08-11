#!/bin/sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Ensuring AI delivery directories and core files exist..."
mkdir -p "$ROOT_DIR/agents/00-implementation-manager"
mkdir -p "$ROOT_DIR/project/requirements"
mkdir -p "$ROOT_DIR/project/architecture"
mkdir -p "$ROOT_DIR/project/decisions"
mkdir -p "$ROOT_DIR/project/backlog"
mkdir -p "$ROOT_DIR/project/handoffs"
mkdir -p "$ROOT_DIR/project/reviews"
mkdir -p "$ROOT_DIR/project/risks"
mkdir -p "$ROOT_DIR/project/reports"
mkdir -p "$ROOT_DIR/scripts/agents"
mkdir -p "$ROOT_DIR/scripts/bootstrap"
mkdir -p "$ROOT_DIR/scripts/validation"

echo "Bootstrap structure is present."
