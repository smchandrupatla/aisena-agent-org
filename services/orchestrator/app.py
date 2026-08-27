#!/usr/bin/env python3
"""Flask API for the Autonomous Dev Shop Orchestrator (REQ-0007 / ADR-0004)."""
import os
from pathlib import Path

from flask import Flask, jsonify, request

from github_client import GitHubClient
from orchestrator import Orchestrator

app = Flask(__name__)

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "project" / "orchestrator"
AGENTS_DIR = ROOT / "agents"

engine = Orchestrator(root_dir=DATA_DIR, agents_dir=AGENTS_DIR, github_client=GitHubClient())


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/orchestrator/apps", methods=["GET"])
def list_apps():
    return jsonify({"apps": engine.apps.list_apps()})


@app.route("/orchestrator/apps", methods=["POST"])
def onboard_app():
    payload = request.get_json(force=True) or {}
    try:
        app_record = engine.onboard_client(
            client_id=payload["client_id"],
            app_name=payload["app_name"],
            app_type=payload["app_type"],
            push_mode=payload["push_mode"],
            create_repo=bool(payload.get("create_repo", False)),
        )
    except (KeyError, ValueError) as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"app": app_record}), 201


@app.route("/orchestrator/apps/<app_id>", methods=["GET"])
def get_app(app_id):
    app_record = engine.apps.get_app(app_id)
    if not app_record:
        return jsonify({"error": "not found"}), 404
    return jsonify({"app": app_record})


@app.route("/orchestrator/apps/<app_id>/specs", methods=["POST"])
def submit_spec(app_id):
    payload = request.get_json(force=True) or {}
    spec_text = payload.get("spec", "")
    if not spec_text:
        return jsonify({"error": "spec is required"}), 400
    try:
        result = engine.submit_spec(app_id, spec_text)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify(result), 201


@app.route("/orchestrator/apps/<app_id>/history", methods=["GET"])
def get_history(app_id):
    try:
        history = engine.get_app_history(app_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify({"history": history})


@app.route("/orchestrator/tickets", methods=["GET"])
def list_tickets():
    app_id = request.args.get("app_id")
    return jsonify({"tickets": engine.tickets.list_tickets(app_id=app_id)})


@app.route("/orchestrator/tickets/<ticket_id>/resolve", methods=["POST"])
def resolve_ticket(ticket_id):
    payload = request.get_json(force=True) or {}
    decision = payload.get("decision", "")
    if not decision:
        return jsonify({"error": "decision is required"}), 400
    try:
        ticket = engine.resolve_ticket(ticket_id, decision)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify({"ticket": ticket})


@app.route("/orchestrator/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "service": "orchestrator"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5100"))
    app.run(host="0.0.0.0", port=port)
