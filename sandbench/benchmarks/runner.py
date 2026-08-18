"""Main benchmark runner for AISENA project."""
import os
import sys
import json
from pathlib import Path

def run_all_benchmarks():
    """Execute all benchmark scenarios."""
    benchmark_dir = Path(__file__).parent / "scenarios"
    
    if not benchmark_dir.exists():
        print(f"Benchmark directory not found: {benchmark_dir}")
        return False
    
    # Get all scenario files
    scenarios = list(benchmark_dir.glob("*.py"))
    
    if not scenarios:
        print("No benchmark scenarios found.")
        return False
    
    print(f"Found {len(scenarios)} benchmark scenarios:")
    for i, scenario in enumerate(scenarios, 1):
        print(f"  {i}. {scenario.name}")
    
    # Run each scenario
    results = []
    for scenario in scenarios:
        print(f"\nRunning {scenario.name}...")
        try:
            # Import and run the scenario
            module_name = scenario.stem.replace(".py", "")
            if module_name.startswith("run_"):
                # Skip internal runner modules
                continue
            
            # Execute the scenario
            result = run_scenario(scenario)
            results.append(result)
            print(f"  ✓ Completed: {result.get('task_id', 'N/A')}")
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            results.append({"error": str(e)})
    
    return len(results) > 0

def run_scenario(scenario_file):
    """Run a single benchmark scenario."""
    # This is a simplified implementation
    # In a real scenario, this would load and execute the benchmark logic
    return {
        "scenario": scenario_file.name,
        "status": "completed",
        "timestamp": "2026-08-17T00:00:00Z"
    }

if __name__ == "__main__":
    success = run_all_benchmarks()
    sys.exit(0 if success else 1)
