# Capabilities Site

This folder contains a static multi-page website that describes the capabilities of the AI development shop.

## Pages
- `index.html` - overview and service map
- `start-project.html` - domain-agnostic intake wizard: describe any application (web, mobile, backend/API, data pipeline, desktop), any deployment target (local, cloud, hybrid), and generate a full SDLC delivery plan, starter backlog, and downloadable project brief
- `capabilities.html` - detailed capability catalog
- `documentation.html` - documentation template catalog and Word template downloads
- `tasks.html` - task menu for execution tracking and ownership
- `issues.html` - issue menu for blockers, risks, and mitigation status
- `workflow.html` - delivery lifecycle and execution model
- `guardrails.html` - safety controls and escalation gates
- `agents-chat.html` - full agent directory and per-agent interaction chat console (supports `?agent=<key>` to preselect an agent)

## Run locally
You can open the html files directly in a browser, or serve them with Python:

```bash
cd services/capabilities_site
python3 -m http.server 8081
```

Then visit `http://localhost:8081`.

## Docker Deployment

### Prerequisites

- Docker installed on your system
- Docker Compose (version 3.8+)

### Quick Start

1. **Navigate to the project root**

```bash
cd /workspaces/-h-s-f-s-agent-org
```

2. **Start all services including the capabilities site**

```bash
docker-compose up -d
```

3. **Access the capabilities site**

- **Via Docker network**: `http://localhost:8081`

### Individual Service Access

- **AISENA Capabilities Site**: `http://localhost:8081`
- **Agent Manager API**: `http://localhost:9500`
- **PostgreSQL**: `localhost:5432`
- **Kafka**: `localhost:9092`
- **OpenSearch**: `localhost:9200`
- **Grafana**: `http://localhost:3000`
- **Prometheus**: `http://localhost:9090`
- **Redmine**: `http://localhost:3001`

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (local or cloud)
- kubectl configured
- Docker registry (or image registry of choice)

### Deployment Files

The following Kubernetes manifests are available:

1. **`k8s-deployment.yml`** - Deployment configuration for the capabilities site
2. **`k8s-service.yml`** - Service configuration (to be created)
3. **`k8s-ingress.yml`** - Ingress configuration (to be created)

### Apply to Kubernetes

1. **Build and push the Docker image**

```bash
# Build the image
docker build -t aisena/capabilities-site:latest ./services/capabilities_site

# Push to registry (example with Docker Hub)
docker push aisena/capabilities-site:latest
```

2. **Apply Kubernetes manifests**

```bash
# Apply deployment
kubectl apply -f services/capabilities_site/k8s-deployment.yml

# Apply service (if created)
# kubectl apply -f services/capabilities_site/k8s-service.yml

# Apply ingress (if created)
# kubectl apply -f services/capabilities_site/k8s-ingress.yml
```

3. **Access the application**

```bash
# Get the service URL
kubectl get svc capabilities-site

# Port forward for local access
kubectl port-forward svc/capabilities-site 8081:3000
```

## Configuration

### Environment Variables

The capabilities site uses the following environment variables:

- `NODE_ENV`: Node environment (default: `production`)
- `NEXT_PUBLIC_API_URL`: Public API URL (default: `/api`)

### Docker Compose Configuration

The capabilities site service in `docker-compose.yml` includes:

- **Build context**: `./services/capabilities_site`
- **Dockerfile**: `Dockerfile`
- **Ports**: `8081:3000`
- **Environment variables**: `NODE_ENV=production`, `NEXT_PUBLIC_API_URL=/api`
- **Dependencies**: `agent-manager` service

## Development

### Local Development

1. **Navigate to the capabilities site directory**

```bash
cd services/capabilities_site
```

2. **Install dependencies**

```bash
npm ci
```

3. **Run development server**

```bash
npm run dev
```

4. **Access the development server**

- **Local development**: `http://localhost:3000`
- **With Docker Compose**: `http://localhost:8081`

### Building for Production

```bash
npm run build
npm run start
```

## Monitoring and Management

### Health Checks

The capabilities site includes health checks:

- **Liveness probe**: Checks if the application is running
- **Readiness probe**: Checks if the application is ready to receive traffic

### Resource Management

The Kubernetes deployment includes resource requests and limits:

- **Memory requests**: 128Mi
- **CPU requests**: 100m
- **Memory limits**: 512Mi
- **CPU limits**: 500m

## Integration with AISENA System

The capabilities site integrates with the AISENA system through:

1. **Agent Manager**: The capabilities site depends on the agent-manager service
2. **API Endpoints**: The site can communicate with the agent runtime API
3. **Real-time Updates**: The site uses real-time data from the agent learning system

## Security Considerations

### Docker Security

- Use minimal base images
- Run containers with non-root users
- Limit container capabilities
- Use read-only file systems where possible

### Kubernetes Security

- Use namespace isolation
- Implement proper RBAC
- Use network policies
- Enable pod security standards

## Troubleshooting

### Common Issues

1. **Port conflicts**

```bash
# Check if ports are already in use
lsof -i :8081
# Or
netstat -tlnp | grep :8081
```

2. **Docker build errors**

```bash
# Clean up and rebuild
docker-compose down --rmi local
docker-compose up -d
```

3. **Kubernetes deployment issues**

```bash
# Check deployment status
kubectl get deployments
kubectl describe deployment capabilities-site
kubectl logs deployment/capabilities-site
```

### Getting Help

- **Documentation**: Check the main AISENA documentation
- **Community**: Join the AISENA community
- **Issues**: Report issues on GitHub

## Migration Guide

### From Previous Versions

If upgrading from a previous version:

1. **Backup existing data**
2. **Update Docker images**
3. **Review configuration changes**
4. **Test in staging environment**

## Conclusion

The AISENA Capabilities Site Docker/Kubernetes deployment provides a robust, scalable, and secure way to deploy the capabilities site in production environments. The deployment includes proper health checks, resource management, and integration with the broader AISENA system.

For more information, refer to the main AISENA documentation and the individual service documentation.

## Sync with real agents
The agent directory/chat is wired to `agents.json`, generated from real folders in `/agents`.

```bash
cd services/capabilities_site
python3 sync_agents.py
```

This refreshes names, focus text, agent file paths, and runner commands.

## Sync Word templates
Copy generated `.docx` templates into this site and rebuild downloadable catalog:

```bash
cd services/capabilities_site
python3 sync_word_templates.py
```

