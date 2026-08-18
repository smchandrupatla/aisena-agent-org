# AISENA Agent Docker Image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ai_agent_config.yaml ./
COPY benchmarks/ ./benchmarks/
COPY infra/ ./infrastructure/
COPY dev-tools/ ./dev-tools/

# Install additional dev tools
RUN pip install -r requirements.txt

# Expose ports
EXPOSE 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["python", "-m", "benchmarks.runner"]
