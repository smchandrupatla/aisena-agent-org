import unittest

from scripts.agents.self_learn_and_ingest import build_prompt, normalize_title, parse_findings, validate_finding


class SelfLearnIngestTests(unittest.TestCase):
    def test_normalize_title_supports_title_deduplication(self):
        self.assertEqual(normalize_title("Add auth-test coverage!"), "add auth test coverage")
        self.assertEqual(normalize_title("add_auth test coverage"), "add auth test coverage")

    def test_parse_findings_accepts_json_embedded_in_cli_output(self):
        response = 'Review complete. {"findings":[{"title":"Add tests","type":"task"}]}'
        self.assertEqual(parse_findings(response)[0]["title"], "Add tests")

    def test_validate_requires_acceptance_for_code_work(self):
        finding = {
            "title": "Fix endpoint validation",
            "description": "The endpoint accepts invalid input.",
            "type": "bug",
            "severity": "high",
            "priority": "P1",
            "status": "open",
            "estimated_effort": "S",
        }
        with self.assertRaisesRegex(ValueError, "Acceptance"):
            validate_finding(finding)

    def test_prompt_requires_machine_readable_output(self):
        self.assertIn('"findings"', build_prompt("qa-engineer", "Test APIs."))


if __name__ == "__main__":
    unittest.main()
