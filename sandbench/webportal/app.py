"""AISENA Web Portal - Main application"""
from flask import Flask, render_template, jsonify
import json
import os
import yaml
from datetime import datetime

app = Flask(__name__)

# Load configuration
config_path = os.path.join(os.path.dirname(__file__), '..', 'ai_agent_config.yaml')
infrastructure_path = os.path.join(os.path.dirname(__file__), '..', 'infrastructure', 'config.yaml')

@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template('dashboard.html')

@app.route('/api/config')
def get_config():
    """Get agent configuration"""
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        return jsonify({
            'status': 'success',
            'config': config
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/infrastructure')
def get_infrastructure():
    """Get infrastructure configuration"""
    try:
        with open(infrastructure_path, 'r') as f:
            infra = yaml.safe_load(f)
        return jsonify({
            'status': 'success',
            'infrastructure': infra
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/benchmarks')
def get_benchmarks():
    """Get benchmark status"""
    benchmarks = [
        {
            'name': 'Reasoning Benchmark',
            'status': 'completed',
            'accuracy': 0.98,
            'last_run': '2026-08-18T10:30:00Z',
            'tasks_completed': 150
        },
        {
            'name': 'Tool Use Benchmark',
            'status': 'running',
            'accuracy': 0.96,
            'last_run': '2026-08-18T10:35:00Z',
            'tasks_completed': 89
        }
    ]
    return jsonify({
        'status': 'success',
        'benchmarks': benchmarks
    })

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)