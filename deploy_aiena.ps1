# AISENA Deployment Script
# Clean deployment of all AISENA services

Write-Host "=== AISENA Docker Deployment ==="

# 1. Stop any running Docker processes
Write-Host "Stopping any running Docker processes..."
Get-Process | Where-Object {$_.ProcessName -match "docker|Docker"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 2. Start Docker Desktop
Write-Host "Starting Docker Desktop..."
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Write-Host "Waiting for Docker Desktop to initialize..."
Start-Sleep -Seconds 15

# 3. Navigate to infra directory and deploy services
Set-Location "c:\GitHub\aisena-agent-org\infra"

# 4. Build and start all services with clean cache
Write-Host "Building and deploying AISENA services..."
docker compose down 2>$null
docker compose build --no-cache
docker compose up -d

# 5. Wait for services to initialize
Write-Host "Waiting for services to start..."
Start-Sleep -Seconds 20

# 6. Check running services
Write-Host "Service status:"
docker compose ps

# 7. Display access information
Write-Host "`nAISENA Services are now running:"
Write-Host "  - Agent Manager API: http://localhost:9500"
Write-Host "  - Capabilities Site: http://localhost:8081"
Write-Host "  - Grafana: http://localhost:3000 (admin/admin)"
Write-Host "  - OpenSearch: http://localhost:9200"
Write-Host "  - Prometheus: http://localhost:9090"
Write-Host "  - Loki: http://localhost:3100"
Write-Host "  - Redmine: http://localhost:3001"
Write-Host "  - Apicurio Registry: http://localhost:8080"
Write-Host "  - Vault: http://localhost:8200 (token: root)"
Write-Host ""
Write-Host "Deployment completed successfully!"