# AISENA Kubernetes Deployment Script
# Builds all service images against Minikube's Docker daemon and applies the k8s/ manifests.

param(
    [switch]$SkipBuild,
    [string]$Profile = "minikube"
)

Write-Host "=== AISENA Kubernetes Deployment ==="
Set-Location $PSScriptRoot

# 1. Ensure Minikube is running
$status = minikube status -p $Profile 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting Minikube profile '$Profile'..."
    minikube start -p $Profile
} else {
    Write-Host "Minikube profile '$Profile' already running."
}

# 2. Point the local Docker CLI at Minikube's daemon so built images are visible to the cluster
Write-Host "Pointing Docker CLI at Minikube's daemon..."
& minikube -p $Profile docker-env | Invoke-Expression

if (-not $SkipBuild) {
    # 3. Build all service images
    Write-Host "Building images..."
    docker build -t aisena/agent-manager:latest -f Dockerfile.agent-manager .
    docker build -t aisena/api:latest -f services/api/Dockerfile .
    docker build -t aisena/ingestion:latest -f services/ingestion/Dockerfile .
    docker build -t aisena/detection:latest -f services/detection/Dockerfile .
    docker build -t aisena/capabilities-site:latest ./services/capabilities_site
} else {
    Write-Host "Skipping image build (-SkipBuild)."
}

# 4. Enable ingress addon (idempotent)
minikube -p $Profile addons enable ingress | Out-Null

# 5. Apply manifests
Write-Host "Applying Kubernetes manifests..."
kubectl apply -k k8s/

# 6. Wait for rollouts
Write-Host "Waiting for deployments to become ready..."
foreach ($dep in @("agent-manager", "api", "detection", "capabilities-site", "grafana", "prometheus")) {
    kubectl -n aisena rollout status "deployment/$dep" --timeout=180s
}

Write-Host "`nPod status:"
kubectl -n aisena get pods

Write-Host "`nAISENA is deployed to Kubernetes (namespace: aisena)."
Write-Host "Access services with, e.g.:"
Write-Host "  kubectl -n aisena port-forward svc/capabilities-site 8081:3000"
Write-Host "  kubectl -n aisena port-forward svc/api 5000:5000"
Write-Host "  kubectl -n aisena port-forward svc/grafana 3000:3000"
Write-Host "See k8s/README.md for the full access and troubleshooting guide."
