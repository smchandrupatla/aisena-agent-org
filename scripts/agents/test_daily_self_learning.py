import subprocess
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from scripts.agents import daily_self_learning


class DailySelfLearningTests(unittest.TestCase):
    def test_prompt_requires_current_evidence(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            agent_path = Path(temp_dir) / "05-backend-engineer"
            agent_path.mkdir()
            (agent_path / "AGENT.md").write_text("Build reliable APIs.", encoding="utf-8")

            prompt = daily_self_learning.build_learning_prompt(agent_path)

        self.assertIn("last 24 hours", prompt)
        self.assertIn("Do not invent a finding or citation", prompt)
        self.assertIn("EVIDENCE:", prompt)
        self.assertIn("Build reliable APIs.", prompt)

    def test_failed_research_is_reported(self):
        result = subprocess.CompletedProcess(
            args=["copilot"], returncode=1, stdout="", stderr="runtime unavailable"
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            agent_path = Path(temp_dir)
            (agent_path / "AGENT.md").write_text("Test agent.", encoding="utf-8")
            response = daily_self_learning.run_agent_research(
                agent_path, runner=lambda *args, **kwargs: result
            )

        self.assertIn("Research could not run (exit 1)", response)
        self.assertIn("runtime unavailable", response)
        self.assertIsNone(daily_self_learning.extract_learning(response))

    def test_run_once_records_learning_and_writes_report(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            agent_path = root / "agents" / "05-backend-engineer"
            agent_path.mkdir(parents=True)
            (agent_path / "AGENT.md").write_text("Build reliable APIs.", encoding="utf-8")
            report_dir = root / "reports"
            response = """FINDING: Contract tests catch integration drift.
WHY_IT_MATTERS: They protect AISENA service boundaries.
EVIDENCE: https://example.test/research, 2026-08-15
RECOMMENDED_ACTION: Add one consumer contract test."""

            with (
                patch.object(daily_self_learning, "ROOT", root),
                patch.object(daily_self_learning, "REPORTS_DIR", report_dir),
                patch.object(daily_self_learning, "agent_paths", return_value=[agent_path]),
                patch.object(daily_self_learning, "utc_now", return_value=datetime(2026, 8, 15, tzinfo=timezone.utc)),
                patch.object(daily_self_learning, "record_learning") as record_learning,
            ):
                report_path = daily_self_learning.run_once(
                    runner=lambda *args, **kwargs: subprocess.CompletedProcess(
                        args=["copilot"], returncode=0, stdout=response, stderr=""
                    )
                )

            self.assertEqual(report_path, report_dir / "2026-08-15.md")
            self.assertIn("Contract tests catch integration drift", report_path.read_text(encoding="utf-8"))
            record_learning.assert_called_once_with(
                agent="05-backend-engineer",
                learning="Contract tests catch integration drift.",
                context="daily domain self-learning",
                evidence="reports/2026-08-15.md",
            )


if __name__ == "__main__":
    unittest.main()