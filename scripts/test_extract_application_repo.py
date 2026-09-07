#!/usr/bin/env python3
"""Tests for application extraction (shop paths must not leak)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ExtractApplicationRepoTests(unittest.TestCase):
    def test_manifest_loads_and_has_excludes(self):
        from scripts.extract_application_repo import load_manifest

        m = load_manifest()
        self.assertIn("include", m)
        self.assertIn("exclude_always", m)
        self.assertIn("agents", m["exclude_always"])
        self.assertIn("docs", m["exclude_always"])

    def test_dry_run_lists_only_existing_includes(self):
        from scripts.extract_application_repo import extract

        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "extract"
            paths = extract(out, dry_run=True)
        self.assertIsInstance(paths, list)

    def test_extract_omits_shop_paths(self):
        from scripts.extract_application_repo import extract

        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "extract"
            extract(out, dry_run=False)
            self.assertFalse((out / "agents").exists())
            self.assertFalse((out / "docs" / "AGENT_CHANGE_LOG.md").exists())
            self.assertTrue((out / "EXTRACT_README.md").is_file())


if __name__ == "__main__":
    unittest.main()
