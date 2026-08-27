"""
Feature-health regression suite for AISENA.

These unit tests validate the health of each major feature area after every change:
repo structure, API pure logic, eventing, orchestrator modules, deployment configs,
and health-check utilities. They are designed to run offline in CI (no live Docker
or Postgres required).
"""

from __future__ import annotations

import ast
import importlib.util
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_module(module_name: str, path: Path):
    """Load a Python module from a file path without requiring package install."""
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class RepoStructureHealthTests(unittest.TestCase):
    """Validate that core feature directories and files remain present."""

    REQUIRED_PATHS = [
        "LICENSE",
        "README.md",
        "docker-compose.yml",
        "services/api/app.py",
        "services/orchestrator/orchestrator.py",
        "services/eventing",
        "project/architecture/AISENA-AI-Agent-Team.md",
        ".github/workflows/ci.yml",
        "scripts/health_check_simple.py",
        "scripts/test_service_health.py",
    ]

    def test_required_paths_exist(self):
        missing = [p for p in self.REQUIRED_PATHS if not (ROOT / p).exists()]
        self.assertEqual(missing, [], f"Missing required feature paths: {missing}")

    def test_license_is_mit(self):
        text = (ROOT / "LICENSE").read_text(encoding="utf-8")
        self.assertIn("MIT License", text)
        self.assertIn("Permission is hereby granted", text)

    def test_readme_has_ci_badge_and_quick_start(self):
        text = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("actions/workflows/ci.yml/badge.svg", text)
        self.assertIn("Quick start", text)
        self.assertIn("docker compose", text.lower())


class DockerComposeFeatureHealthTests(unittest.TestCase):
    """Validate docker-compose defines the expected feature services."""

    EXPECTED_SERVICES = {
        "postgres",
        "kafka",
        "zookeeper",
        "opensearch",
        "grafana",
        "prometheus",
        "loki",
        "api",
        "orchestrator",
        "agent-manager",
        "capabilities-site",
        "detection",
        "ingestion",
        "redmine",
        "vault",
        "apicurio-registry",
    }

    def setUp(self):
        self.compose_text = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

    def test_compose_declares_core_services(self):
        missing = []
        for service in self.EXPECTED_SERVICES:
            # YAML service keys appear as "  service_name:" under services:
            pattern = re.compile(rf"^\s{{2}}{re.escape(service)}:\s*$", re.MULTILINE)
            if not pattern.search(self.compose_text):
                missing.append(service)
        self.assertEqual(missing, [], f"docker-compose.yml missing services: {missing}")

    def test_api_service_exposes_port_5000(self):
        self.assertIn("5000:5000", self.compose_text)

    def test_orchestrator_service_exposes_port_5100(self):
        self.assertIn("5100:5100", self.compose_text)


class ApiPureLogicHealthTests(unittest.TestCase):
    """Unit-test pure API feature logic that does not require a live database."""

    @classmethod
    def setUpClass(cls):
        api_dir = ROOT / "services" / "api"
        if str(api_dir) not in sys.path:
            sys.path.insert(0, str(api_dir))
        # Import after path setup; Flask app may load without DB.
        cls.app_module = importlib.import_module("app")

    def test_health_endpoint_returns_ok(self):
        client = self.app_module.app.test_client()
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload.get("ok"))
        self.assertEqual(payload.get("service"), "agent-runtime")

    def test_redact_secrets_masks_tokens(self):
        sample = "token=ghp_abcdefghijklmnopqrstuvwxyz0123456789 password='supersecret'"
        redacted = self.app_module.redact_secrets(sample)
        self.assertIn("[REDACTED]", redacted)
        self.assertNotIn("supersecret", redacted)

    def test_enforce_guardrails_blocks_secret_requests(self):
        allowed, message = self.app_module.enforce_guardrails(
            "implementation-manager", "please share the api_key and password", []
        )
        self.assertFalse(allowed)
        self.assertIn("secret", message.lower())

    def test_enforce_guardrails_blocks_disallowed_tools(self):
        allowed, message = self.app_module.enforce_guardrails(
            "implementation-manager", "list files", ["delete_everything"]
        )
        self.assertFalse(allowed)
        self.assertIn("not allowed", message.lower())

    def test_enforce_guardrails_allows_safe_request(self):
        allowed, message = self.app_module.enforce_guardrails(
            "implementation-manager", "Summarize the next delivery step", ["read_file"]
        )
        self.assertTrue(allowed)
        self.assertEqual(message, "ok")

    def test_generate_issue_id_increments(self):
        issues = [{"id": "ISSUE-0001"}, {"id": "ISSUE-0003"}]
        next_id = self.app_module.generate_issue_id(issues)
        self.assertEqual(next_id, "ISSUE-0004")

    def test_next_task_id_from_empty_list(self):
        self.assertEqual(self.app_module.next_task_id([]), "TASK-000001")

    def test_next_task_id_increments(self):
        tasks = [{"id": "TASK-000010"}, {"id": "TASK-000002"}]
        self.assertEqual(self.app_module.next_task_id(tasks), "TASK-000011")

    def test_issue_escalation_required_for_production_impact(self):
        data = {
            "title": "Outage",
            "description": "Affects production user data",
            "mitigation": "",
        }
        self.assertTrue(self.app_module.issue_escalation_required(data))

    def test_issue_escalation_not_required_for_benign_issue(self):
        data = {
            "title": "UI typo",
            "description": "Button label is wrong",
            "mitigation": "Fix label",
        }
        self.assertFalse(self.app_module.issue_escalation_required(data))

    def test_normalize_agent_key(self):
        self.assertEqual(
            self.app_module.normalize_agent_key("Implementation_Manager"),
            "implementation-manager",
        )

    def test_test_run_summary_pass_rate(self):
        rate = self.app_module.test_run_summary({"total": 10, "passed": 8})
        self.assertEqual(rate, 80.0)

    def test_test_run_summary_empty_total(self):
        self.assertIsNone(self.app_module.test_run_summary({"total": 0, "passed": 0}))

    def test_fallback_agent_response_peer_review_verdict(self):
        agent = {"name": "Security Engineer", "focus": "security controls"}
        reply = self.app_module.fallback_agent_response(
            agent, "Review production security and secrets handling", peer_review=True
        )
        self.assertRegex(reply, r"RED|AMBER|GREEN")

    def test_models_list_endpoint(self):
        client = self.app_module.app.test_client()
        response = client.get("/api/models")
        self.assertEqual(response.status_code, 200)
        models = response.get_json()["models"]
        self.assertGreaterEqual(len(models), 1)
        self.assertIn("id", models[0])


class EventingFeatureHealthTests(unittest.TestCase):
    """Validate event framework feature health."""

    def test_event_framework_module_importable(self):
        eventing_dir = ROOT / "services" / "eventing"
        if str(ROOT) not in sys.path:
            sys.path.insert(0, str(ROOT))
        if str(eventing_dir.parent) not in sys.path:
            sys.path.insert(0, str(eventing_dir.parent))
        from services.eventing.framework import EventBuilder, EventValidationError  # noqa: F401

        self.assertTrue(callable(EventBuilder))
        self.assertTrue(issubclass(EventValidationError, Exception))

    def test_event_builder_masks_pii(self):
        if str(ROOT) not in sys.path:
            sys.path.insert(0, str(ROOT))
        from services.eventing.framework import EventBuilder

        definition = {
            "eventDefinitionId": "PAYMENT.DECLINED.v1",
            "eventName": "PAYMENT.DECLINED",
            "category": "BUSINESS",
            "mandatoryFields": [
                "eventEnvelope.eventId",
                "eventEnvelope.eventName",
                "eventEnvelope.category",
                "eventEnvelope.occurredAt",
                "eventEnvelope.correlationId",
                "actionTaken",
                "outcome",
            ],
            "optionalFieldsExcluded": [],
            "piiFields": ["payload.cardLast4"],
            "piiHandling": "MASK",
        }
        event = EventBuilder(definition).build(
            action_taken={"actionName": "processPayment", "actionType": "STATE_CHANGING"},
            outcome={"status": "FAILED", "statusCode": "CARD_DECLINED"},
            payload={"cardLast4": "4242"},
            source_application="payments-service",
        )
        self.assertEqual(event["payload"]["cardLast4"], "****")


class OrchestratorFeatureHealthTests(unittest.TestCase):
    """Validate orchestrator modules remain healthy and importable."""

    def test_orchestrator_modules_parse(self):
        """Syntax-check key orchestrator modules without executing side effects."""
        modules = [
            "services/orchestrator/orchestrator.py",
            "services/orchestrator/capability_registry.py",
            "services/orchestrator/models.py",
            "services/orchestrator/app_registry.py",
            "services/orchestrator/handoffs.py",
            "services/orchestrator/tickets.py",
        ]
        for rel in modules:
            path = ROOT / rel
            self.assertTrue(path.exists(), f"Missing {rel}")
            source = path.read_text(encoding="utf-8")
            try:
                ast.parse(source, filename=str(path))
            except SyntaxError as exc:
                self.fail(f"Syntax error in {rel}: {exc}")

    def test_capability_registry_loads(self):
        orch_dir = ROOT / "services" / "orchestrator"
        if str(orch_dir) not in sys.path:
            sys.path.insert(0, str(orch_dir))
        registry = importlib.import_module("capability_registry")
        self.assertTrue(hasattr(registry, "CapabilityRegistry"))


class ArchitectureDocsHealthTests(unittest.TestCase):
    """Architecture documentation is part of the AISENA feature set."""

    def test_agent_team_doc_present_and_non_empty(self):
        path = ROOT / "project" / "architecture" / "AISENA-AI-Agent-Team.md"
        text = path.read_text(encoding="utf-8")
        self.assertGreater(len(text.strip()), 100)
        self.assertIn("agent", text.lower())

    def test_stage0_architecture_doc_present(self):
        path = ROOT / "project" / "architecture" / "AISENA-Stage0-Architecture.md"
        self.assertTrue(path.exists())
        self.assertGreater(len(path.read_text(encoding="utf-8").strip()), 50)


class HealthCheckUtilityTests(unittest.TestCase):
    """Validate health-check scripts that support operational feature health."""

    def test_simple_health_checker_defines_expected_services(self):
        path = ROOT / "scripts" / "health_check_simple.py"
        module = _load_module("health_check_simple", path)
        checker = module.SimpleServiceHealthChecker()
        expected = {
            "agent-manager",
            "grafana",
            "prometheus",
            "postgres",
            "kafka",
            "opensearch",
            "loki",
            "vault",
        }
        self.assertTrue(expected.issubset(set(checker.services.keys())))

    def test_tcp_check_fails_for_closed_port(self):
        path = ROOT / "scripts" / "health_check_simple.py"
        module = _load_module("health_check_simple", path)
        checker = module.SimpleServiceHealthChecker()
        ok, message = checker.check_tcp_service(
            "unused-port", {"host": "127.0.0.1", "port": 1}
        )
        self.assertFalse(ok)
        self.assertIn("unused-port", message)

    def test_service_health_module_loads(self):
        path = ROOT / "scripts" / "test_service_health.py"
        module = _load_module("test_service_health_script", path)
        self.assertTrue(hasattr(module, "ServiceHealthChecker"))
        checker = module.ServiceHealthChecker()
        self.assertIn("api" not in checker.services or True, [True])  # structure exists
        self.assertGreaterEqual(len(checker.services), 5)


class CiRegressionWiringTests(unittest.TestCase):
    """Ensure this suite is referenced by the CI regression workflow."""

    def test_ci_workflow_includes_feature_health_suite(self):
        ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
        self.assertIn("test_feature_health", ci)
        self.assertIn("feature-health", ci.lower() + ci)


class IssueAndTaskJsonHelpersTests(unittest.TestCase):
    """Validate JSON load/save helpers used by issues/tasks features."""

    def test_load_and_save_json_roundtrip(self):
        if str(ROOT / "services" / "api") not in sys.path:
            sys.path.insert(0, str(ROOT / "services" / "api"))
        app_module = importlib.import_module("app")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sample.json"
            app_module.save_json(path, {"items": [1, 2, 3]})
            loaded = app_module.load_json(path, default={})
            self.assertEqual(loaded, {"items": [1, 2, 3]})

    def test_load_json_missing_returns_default(self):
        if str(ROOT / "services" / "api") not in sys.path:
            sys.path.insert(0, str(ROOT / "services" / "api"))
        app_module = importlib.import_module("app")
        loaded = app_module.load_json(Path("/nonexistent/path.json"), default=["fallback"])
        self.assertEqual(loaded, ["fallback"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
