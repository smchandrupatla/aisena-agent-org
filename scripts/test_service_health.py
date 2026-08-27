#!/usr/bin/env python3
"""
Basic health checks for AISENA Docker services.
This script validates that all services are running and responding to health checks.
"""

import requests
import socket
import time
import sys
from typing import Dict, Tuple, Optional

class ServiceHealthChecker:
    def __init__(self):
        self.services = {
            "agent-manager": {"url": "http://localhost:9500", "path": "/health", "expected_status": 200},
            "grafana": {"url": "http://localhost:3000", "path": "/api/health", "expected_status": 200},
            "prometheus": {"url": "http://localhost:9090", "path": "/-/healthy", "expected_status": 200},
            "redmine": {"url": "http://localhost:3001", "path": "/health", "expected_status": 200},
            "kafka": {"host": "localhost", "port": 9092, "protocol": "TCP"},
            "postgres": {"host": "localhost", "port": 5432, "protocol": "TCP"},
            "opensearch": {"url": "http://localhost:9200", "path": "/", "expected_status": 200},
            "loki": {"url": "http://localhost:3100", "path": "/ready", "expected_status": 200},
            "zookeeper": {"host": "localhost", "port": 2181, "protocol": "TCP"},
            "vault": {"url": "http://localhost:8200", "path": "/v1/sys/health", "expected_status": 200},
            "apicurio-registry": {"url": "http://localhost:8080", "path": "/api/v1/health", "expected_status": 200},
            "capabilities-site": {"url": "http://localhost:8081", "path": "/", "expected_status": 200},
        }
    
    def check_http_service(self, name: str, config: Dict) -> Tuple[bool, str]:
        """Check HTTP service health."""
        try:
            url = f"{config['url']}{config['path']}"
            response = requests.get(url, timeout=5)
            
            if response.status_code == config['expected_status']:
                return True, f"✅ {name}: HTTP {response.status_code}"
            else:
                return False, f"❌ {name}: HTTP {response.status_code} (expected {config['expected_status']})"
                
        except requests.exceptions.RequestException as e:
            return False, f"❌ {name}: Connection failed - {str(e)}"
    
    def check_tcp_service(self, name: str, config: Dict) -> Tuple[bool, str]:
        """Check TCP service health."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((config['host'], config['port']))
            sock.close()
            
            if result == 0:
                return True, f"✅ {name}: TCP connection successful"
            else:
                return False, f"❌ {name}: TCP connection failed (port {config['port']} not reachable)"
                
        except Exception as e:
            return False, f"❌ {name}: TCP check failed - {str(e)}"
    
    def check_service(self, name: str, config: Dict) -> Tuple[bool, str]:
        """Check service health based on its type."""
        if 'protocol' in config:
            return self.check_tcp_service(name, config)
        else:
            return self.check_http_service(name, config)
    
    def run_health_checks(self) -> Dict[str, Tuple[bool, str]]:
        """Run health checks for all services."""
        results = {}
        
        for name, config in self.services.items():
            print(f"Checking {name}...", end=" ")
            is_healthy, message = self.check_service(name, config)
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
    print("This may take a few minutes depending on service response times.\n")
    
    checker = ServiceHealthChecker()
    results = checker.run_health_checks()
    
    report = checker.generate_report(results)
    print(report)
    
    # Save report to file
    with open("service_health_report.txt", "w") as f:
        f.write(report)
    
    print("Report saved to: service_health_report.txt")
    
    # Exit with appropriate code
    healthy_count = sum(1 for is_healthy, _ in results.values() if is_healthy)
    total_count = len(results)
    
    if healthy_count == total_count:
        print("\n✅ All services are healthy!")
        sys.exit(0)
    else:
        print(f"\n❌ {total_count - healthy_count} services are unhealthy.")
        sys.exit(1)

if __name__ == "__main__":
    main()
