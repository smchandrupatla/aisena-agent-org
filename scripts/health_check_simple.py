#!/usr/bin/env python3
"""
Simple health checks for AISENA Docker services.
This script validates that all services are running and responding to basic connectivity checks.
"""

import socket
import sys
from typing import Dict, Tuple

class SimpleServiceHealthChecker:
    def __init__(self):
        self.services = {
            "agent-manager": {"host": "localhost", "port": 9500, "protocol": "TCP"},
            "grafana": {"host": "localhost", "port": 3000, "protocol": "TCP"},
            "prometheus": {"host": "localhost", "port": 9090, "protocol": "TCP"},
            "redmine": {"host": "localhost", "port": 3001, "protocol": "TCP"},
            "kafka": {"host": "localhost", "port": 9092, "protocol": "TCP"},
            "postgres": {"host": "localhost", "port": 5432, "protocol": "TCP"},
            "opensearch": {"host": "localhost", "port": 9200, "protocol": "TCP"},
            "loki": {"host": "localhost", "port": 3100, "protocol": "TCP"},
            "zookeeper": {"host": "localhost", "port": 2181, "protocol": "TCP"},
            "vault": {"host": "localhost", "port": 8200, "protocol": "TCP"},
            "apicurio-registry": {"host": "localhost", "port": 8080, "protocol": "TCP"},
            "capabilities-site": {"host": "localhost", "port": 8081, "protocol": "TCP"},
        }
    
    def check_tcp_service(self, name: str, config: Dict) -> Tuple[bool, str]:
        """Check TCP service health."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((config['host'], config['port']))
            sock.close()
            
            if result == 0:
                return True, f"✅ {name}: TCP connection successful (port {config['port']})"
            else:
                return False, f"❌ {name}: TCP connection failed (port {config['port']} not reachable)"
                
        except Exception as e:
            return False, f"❌ {name}: TCP check failed - {str(e)}"
    
    def run_health_checks(self) -> Dict[str, Tuple[bool, str]]:
        """Run health checks for all services."""
        results = {}
        
        for name, config in self.services.items():
            print(f"Checking {name}...", end=" ")
            is_healthy, message = self.check_tcp_service(name, config)
            results[name] = (is_healthy, message)
            print(message)
            
        return results
    
    def generate_report(self, results: Dict[str, Tuple[bool, str]]) -> str:
        """Generate a comprehensive health report."""
        healthy_count = sum(1 for is_healthy, _ in results.values() if is_healthy)
        total_count = len(results)
        
        report = f"""
{'='*60}
AISENA SERVICE HEALTH REPORT
{'='*60}
Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}
{'='*60}

SUMMARY:
✅ Healthy: {healthy_count}/{total_count} services
❌ Unhealthy: {total_count - healthy_count}/{total_count} services

{'='*60}
DETAILED RESULTS:
{'='*60}
"""
        
        for name, (is_healthy, message) in sorted(results.items()):
            report += f"{message}\n"
        
        report += f"\n{'='*60}\n"
        
        if healthy_count == total_count:
            report += "🎉 ALL SERVICES ARE HEALTHY!\n"
        else:
            report += "⚠️  SOME SERVICES ARE UNHEALTHY. PLEASE INVESTIGATE.\n"
        
        report += f"{'='*60}\n"
        
        return report

def main():
    print("Starting AISENA service health checks...")
    print("This will check TCP connectivity for all services.\n")
    
    checker = SimpleServiceHealthChecker()
    results = checker.run_health_checks()
    
    # Generate report without encoding issues
    healthy_count = sum(1 for is_healthy, _ in results.values() if is_healthy)
    total_count = len(results)
    
    print(f"\n{'='*60}")
    print(f"AISENA SERVICE HEALTH REPORT")
    print(f"{'='*60}")
    print(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    print(f"SUMMARY:")
    print(f"✅ Healthy: {healthy_count}/{total_count} services")
    print(f"❌ Unhealthy: {total_count - healthy_count}/{total_count} services")
    print(f"{'='*60}")
    print(f"DETAILED RESULTS:")
    print(f"{'='*60}")
    
    for name, (is_healthy, message) in sorted(results.items()):
        print(f"{message}")
    
    print(f"\n{'='*60}")
    if healthy_count == total_count:
        print("🎉 ALL SERVICES ARE HEALTHY!")
    else:
        print("⚠️  SOME SERVICES ARE UNHEALTHY. PLEASE INVESTIGATE.")
    print(f"{'='*60}")
    
    # Save report to file
    with open("service_health_report.txt", "w", encoding='utf-8') as f:
        f.write(f"AISENA SERVICE HEALTH REPORT\n")
        f.write(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"SUMMARY:\n")
        f.write(f"✅ Healthy: {healthy_count}/{total_count} services\n")
        f.write(f"❌ Unhealthy: {total_count - healthy_count}/{total_count} services\n\n")
        f.write(f"DETAILED RESULTS:\n\n")
        
        for name, (is_healthy, message) in sorted(results.items()):
            f.write(f"{message}\n")
        
        f.write(f"\n{'='*60}\n")
        if healthy_count == total_count:
            f.write("🎉 ALL SERVICES ARE HEALTHY!\n")
        else:
            f.write("⚠️  SOME SERVICES ARE UNHEALTHY. PLEASE INVESTIGATE.\n")
        f.write(f"{'='*60}\n")
    
    print("Report saved to: service_health_report.txt")
    
    # Exit with appropriate code
    if healthy_count == total_count:
        print("\n✅ All services are healthy!")
        sys.exit(0)
    else:
        print(f"\n❌ {total_count - healthy_count} services are unhealthy.")
        sys.exit(1)

if __name__ == "__main__":
    import time
    main()
