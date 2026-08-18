# Deployment script for AISENA Docker services
# This script will rebuild and deploy all Docker services

Write-Host "Starting AISENA Docker deployment..."

# Change to infra directory
Set-Location "c:\GitHub\aisena-agent-org\infra"

# Stop any existing services
Write-Host "Stopping existing Docker services..."
docker compose down 2>$null

# Build new images
Write-Host "Building Docker images..."
docker compose build --no-cache

# Start services in detached mode
Write-Host "Starting Docker services..."
docker compose up -d

# Wait for services to be ready
Write-Host "Waiting for services to initialize..."
Start-Sleep -Seconds 15

# Check running services
Write-Host "Checking running services..."
docker compose ps

# Display service URLs
Write-Host "`nServices are now running:"
Write-Host "  - API: http://localhost:9500"
Write-Host "  - Capabilities Site: http://localhost:8081"
Write-Host "  - Grafana: http://localhost:3000 (admin/admin)"
Write-Host "  - OpenSearch: http://localhost:9200"
Write-Host "  - Prometheus: http://localhost:9090"
Write-Host "  - Loki: http://localhost:3100"

Write-Host "`nDeployment complete!"