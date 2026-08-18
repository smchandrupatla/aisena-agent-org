#!/bin/bash
# Benchmark runner script

set -e

PROJECT_DIR="/workspaces/-h-s-f-s-agent-org/sandbench"
SCRIPT_DIR="$PROJECT_DIR/benchmarks/scenarios"

if [ ! -f "run_benchmark.sh" ]; then
    echo "Benchmark script not found. Please run from the sandbench directory."
    exit 1
fi

echo "Running AISENA benchmarks..."
python -m benchmarks.run

echo "Benchmarks completed!"
