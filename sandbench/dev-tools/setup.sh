#!/bin/bash
# Setup script for AISENA project

set -e

echo "Setting up AISENA project..."

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install core dependencies
pip install -r requirements.txt

# Install development tools
pip install -r requirements-dev.txt 2>/dev/null || true

# Initialize version control
git init 2>/dev/null || true

# Copy configuration files
cp ai_agent_config.yaml ./
cp config.yaml ./

# Create .gitignore
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so

# Virtual environments
venv/
.venv/

# IDE
.vscode/
.idea/
*.swp

# Logs
logs/
*.log

# Data
data/
*.csv
*.json
EOF

echo "Setup complete!"
