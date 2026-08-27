#!/usr/bin/env python3
"""Unit tests for runtime feature flags, operator recovery, and tenant isolation."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from services.runtime_ops.feature_flags import FeatureFlagStore
from services.runtime_ops.operator_recovery import OperatorRecoveryService
from services.runtime_ops.tenant import TenantContext, TenantIsolationError, assert_same_tenant, require_tenant_id


class FeatureFlagTests(unittest.TestCase):
    def test_runtime_set_without_restart(self):
        store = FeatureFlagStore(path=None)
        self.assertTrue(store.get("screening.enabled"))
        store.set("screening.enabled", False)
        self.assertFalse(store.get("screening.enabled"))

    def test_persist_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "flags.json"
            store = FeatureFlagStore(path=path)
            store.set("ui.show_diagnostics", False)
            store2 = FeatureFlagStore(path=path)
            self.assertFalse(store2.get("ui.show_diagnostics"))


class OperatorRecoveryTests(unittest.TestCase):
    def test_diagnostics_and_clear_cache(self):
        flags = FeatureFlagStore(path=None)
        svc = OperatorRecoveryService(flags=flags)
        diag = svc.diagnostics()
        self.assertIn(diag["overall"], ("healthy", "degraded", "unhealthy"))
        result = svc.remediate("clear_cache")
        self.assertTrue(result.ok)
        self.assertIn("next", result.next_steps.lower() + result.message.lower())

    def test_disable_screening_flag(self):
        flags = FeatureFlagStore(path=None)
        svc = OperatorRecoveryService(flags=flags)
        result = svc.remediate("disable_screening")
        self.assertTrue(result.ok)
        self.assertFalse(flags.get("screening.enabled"))


class TenantTests(unittest.TestCase):
    def test_require_tenant(self):
        self.assertEqual(require_tenant_id(" acme "), "acme")
        with self.assertRaises(TenantIsolationError):
            require_tenant_id("")

    def test_cross_tenant_denied(self):
        with self.assertRaises(TenantIsolationError):
            assert_same_tenant("t1", "t2")
        assert_same_tenant("t1", "t1")

    def test_context(self):
        ctx = TenantContext(tenant_id="tenant-a")
        self.assertEqual(ctx.tenant_id, "tenant-a")


if __name__ == "__main__":
    unittest.main()
