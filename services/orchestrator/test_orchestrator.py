import json
import shutil
import tempfile
import unittest
from pathlib import Path

from app_registry import AppRegistry
from audit import AuditLog
from capability_registry import CapabilityRegistry
from github_client import GitHubApiError, GitHubClient
from orchestrator import Orchestrator
from tickets import TicketStore


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


class FakeSession:
    """Records every call and returns canned responses keyed by (method, path suffix)."""

    def __init__(self):
        self.calls = []

    def request(self, method, url, headers=None, timeout=None, **kwargs):
        self.calls.append((method, url, kwargs.get("json")))
        if method == "POST" and url.endswith("/pulls"):
            return FakeResponse(201, {"number": 42, "html_url": "https://example.invalid/pr/42"})
        if method == "PUT" and "/pulls/" in url and url.endswith("/merge"):
            return FakeResponse(200, {"merged": True})
        if method == "POST" and url.endswith("/issues"):
            return FakeResponse(201, {"number": 7, "html_url": "https://example.invalid/issues/7"})
        if method == "POST" and url.endswith("/repos"):
            return FakeResponse(201, {"name": "demo-app", "full_name": "acme/demo-app"})
        return FakeResponse(200, {})


class OrchestratorTestBase(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = Path(tempfile.mkdtemp())
        self.data_dir = self.tmp_dir / "orchestrator"
        self.agents_dir = self.tmp_dir / "agents"
        self.agents_dir.mkdir(parents=True)
        self._make_persona("05-backend-engineer", "Backend Engineer for server-side domain logic, APIs, services.")
        self._make_persona("04-frontend-engineer", "Frontend Engineer for UI, screens, dashboards, and UX.")
        self.fake_session = FakeSession()
        self.github = GitHubClient(token="fake-token", org="acme", session=self.fake_session)
        self.engine = Orchestrator(root_dir=self.data_dir, agents_dir=self.agents_dir, github_client=self.github)

    def tearDown(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def _make_persona(self, folder_name, role_line):
        folder = self.agents_dir / folder_name
        folder.mkdir(parents=True)
        (folder / "AGENT.md").write_text(f"# Agent\n\nRole: {role_line}\n", encoding="utf-8")
        (folder / "config.json").write_text('{"skills": ["apis.rest_api"]}', encoding="utf-8")


class AppRegistryTests(OrchestratorTestBase):
    def test_create_and_get_app(self):
        app = self.engine.apps.create_app("Demo App", "client-1", "enterprise", "manual_approval", None)
        self.assertTrue(app["id"].startswith("APP-"))
        fetched = self.engine.apps.get_app(app["id"])
        self.assertEqual(fetched["name"], "Demo App")


class CapabilityRegistryTests(OrchestratorTestBase):
    def test_match_expert_finds_known_persona(self):
        registry = CapabilityRegistry(self.agents_dir)
        match = registry.match_expert("Backend Engineer server-side APIs services")
        self.assertEqual(match, "05-backend-engineer")

    def test_synthesize_expert_creates_new_persona(self):
        registry = CapabilityRegistry(self.agents_dir)
        persona_id = registry.synthesize_expert("Blockchain Specialist", "Own smart contract integration.")
        self.assertEqual(persona_id, "dynamic/blockchain-specialist")
        self.assertTrue((self.agents_dir / "dynamic" / "blockchain-specialist" / "AGENT.md").exists())


class GitHubClientTests(OrchestratorTestBase):
    def test_apply_push_mode_auto_push_merges(self):
        result = self.github.apply_push_mode("demo-app", "auto_push", "Title", "Body", head="feature/x")
        self.assertTrue(result["merged"])
        self.assertEqual(result["pull_request"]["number"], 42)

    def test_apply_push_mode_manual_approval_does_not_merge(self):
        result = self.github.apply_push_mode("demo-app", "manual_approval", "Title", "Body", head="feature/x")
        self.assertFalse(result["merged"])

    def test_invalid_repo_name_rejected(self):
        with self.assertRaises(ValueError):
            self.github.create_issue("../etc/passwd", "t", "b")

    def test_not_configured_raises(self):
        client = GitHubClient(token=None, session=self.fake_session)
        with self.assertRaises(Exception):
            client.create_issue("demo-app", "t", "b")


class OrchestratorEngineTests(OrchestratorTestBase):
    def test_submit_spec_decomposes_and_assigns_experts(self):
        app = self.engine.onboard_client("client-1", "Demo App", "mobile", "manual_approval")
        result = self.engine.submit_spec(app["id"], "Build a frontend dashboard and a backend API for orders.")
        titles = {w["title"] for w in result["workstreams"]}
        self.assertIn("Frontend/UX", titles)
        self.assertIn("Backend Services", titles)
        for ws in result["workstreams"]:
            self.assertIsNotNone(ws["assigned_expert"])

    def test_enterprise_app_gets_interoperability_report(self):
        app = self.engine.onboard_client("client-1", "Enterprise App", "enterprise", "manual_approval")
        result = self.engine.submit_spec(app["id"], "Build an integration between two enterprise systems.")
        self.assertIsNotNone(result["interoperability"])
        self.assertTrue(result["interoperability"]["requires_integration_contract"])

    def test_mobile_app_has_no_interoperability_report(self):
        app = self.engine.onboard_client("client-1", "Mobile App", "mobile", "manual_approval")
        result = self.engine.submit_spec(app["id"], "Build a simple mobile todo list.")
        self.assertIsNone(result["interoperability"])

    def test_escalate_issue_creates_ticket_and_audit_entry(self):
        app = self.engine.onboard_client("client-1", "Demo App", "mobile", "manual_approval")
        ticket = self.engine.escalate_issue(
            app["id"], title="Ambiguous requirement", description="Unclear pricing rule",
            attempted="Reviewed spec twice", why_blocked="Conflicting statements", decision_needed="Clarify pricing",
        )
        self.assertEqual(ticket["status"], "open")
        history = self.engine.get_app_history(app["id"])
        actions = [entry["action"] for entry in history["audit_trail"]]
        self.assertIn("ticket_opened", actions)
        self.assertEqual(len(history["tickets"]), 1)

    def test_unknown_app_id_raises(self):
        with self.assertRaises(ValueError):
            self.engine.submit_spec("APP-9999", "spec text")

    def test_dependent_workstreams_get_a_handoff(self):
        app = self.engine.onboard_client("client-1", "Demo App", "mobile", "manual_approval")
        result = self.engine.submit_spec(app["id"], "Build a database schema, a backend API, and a frontend dashboard.")
        handoffs = result["handoffs"]
        kinds = {(h["kind"]) for h in handoffs}
        self.assertIn("dependency", kinds)
        backend_to_frontend = [h for h in handoffs if h["kind"] == "dependency"]
        self.assertTrue(any(h["from_expert"] and h["to_expert"] for h in backend_to_frontend))

    def test_reviewer_workstream_reviews_every_other_workstream(self):
        app = self.engine.onboard_client("client-1", "Demo App", "mobile", "manual_approval")
        result = self.engine.submit_spec(app["id"], "Build a backend API with strict security compliance and RBAC.")
        review_handoffs = [h for h in result["handoffs"] if h["kind"] == "review"]
        self.assertTrue(len(review_handoffs) >= 1)
        history = self.engine.get_app_history(app["id"])
        self.assertEqual(len(history["handoffs"]), len(result["handoffs"]))

    def test_resubmitting_spec_does_not_duplicate_handoffs(self):
        app = self.engine.onboard_client("client-1", "Demo App", "mobile", "manual_approval")
        first = self.engine.submit_spec(app["id"], "Build a database schema and a backend API.")
        second = self.engine.submit_spec(app["id"], "Build a database schema and a backend API.")
        total_after_both = len(self.engine.handoffs.list_handoffs(app["id"]))
        self.assertEqual(total_after_both, len(first["handoffs"]) + len(second["handoffs"]))

    def test_artifact_gets_assigned_reviewers_from_review_handoffs(self):
        app = self.engine.onboard_client("client-1", "Demo App", "mobile", "manual_approval")
        result = self.engine.submit_spec(app["id"], "Build a backend API with strict security compliance.")
        backend_ws = next(w for w in result["workstreams"] if w["title"] == "Backend Services")
        artifact = self.engine.submit_artifact(app["id"], backend_ws["id"], title="orders API", description="REST endpoints for orders")
        self.assertEqual(artifact["status"], "in_review")
        self.assertTrue(len(artifact["reviewers"]) >= 1)

    def test_peer_review_approval_marks_artifact_approved(self):
        app = self.engine.onboard_client("client-1", "Demo App", "mobile", "manual_approval")
        result = self.engine.submit_spec(app["id"], "Build a backend API with strict security compliance.")
        backend_ws = next(w for w in result["workstreams"] if w["title"] == "Backend Services")
        artifact = self.engine.submit_artifact(app["id"], backend_ws["id"], title="orders API", description="REST endpoints")
        reviewer = artifact["reviewers"][0]["expert"]
        outcome = self.engine.review_artifact(app["id"], artifact["id"], reviewer=reviewer, verdict="approved", comments="Looks good")
        self.assertEqual(outcome["artifact"]["status"], "approved")
        self.assertEqual(outcome["review"]["verdict"], "approved")

    def test_peer_review_changes_requested_creates_revision_handoff(self):
        app = self.engine.onboard_client("client-1", "Demo App", "mobile", "manual_approval")
        result = self.engine.submit_spec(app["id"], "Build a backend API with strict security compliance.")
        backend_ws = next(w for w in result["workstreams"] if w["title"] == "Backend Services")
        artifact = self.engine.submit_artifact(app["id"], backend_ws["id"], title="orders API", description="REST endpoints")
        reviewer = artifact["reviewers"][0]["expert"]
        before_count = len(self.engine.handoffs.list_handoffs(app["id"]))
        outcome = self.engine.review_artifact(
            app["id"], artifact["id"], reviewer=reviewer, verdict="changes_requested", comments="Missing input validation",
        )
        self.assertEqual(outcome["artifact"]["status"], "changes_requested")
        after_handoffs = self.engine.handoffs.list_handoffs(app["id"])
        self.assertEqual(len(after_handoffs), before_count + 1)
        revision = [h for h in after_handoffs if h["kind"] == "revision"]
        self.assertEqual(len(revision), 1)
        self.assertIn("Missing input validation", revision[0]["note"])

    def test_review_unknown_verdict_raises(self):
        app = self.engine.onboard_client("client-1", "Demo App", "mobile", "manual_approval")
        result = self.engine.submit_spec(app["id"], "Build a backend API.")
        backend_ws = result["workstreams"][0]
        artifact = self.engine.submit_artifact(app["id"], backend_ws["id"], title="x", description="y")
        with self.assertRaises(ValueError):
            self.engine.review_artifact(app["id"], artifact["id"], reviewer="someone", verdict="maybe", comments="")


if __name__ == "__main__":
    unittest.main()
