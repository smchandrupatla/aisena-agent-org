#!/usr/bin/env python3
"""Restore services/api/app.py from the checked-in base64 artifact if it is a PLACEHOLDER."""
from pathlib import Path
import base64
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "services" / "api" / "app.py"
B64 = ROOT / "services" / "api" / "app.py.b64"

text = APP.read_text(encoding="utf-8", errors="replace") if APP.exists() else ""
lines = text.count("\n") + (1 if text and not text.endswith("\n") else 0)
needs = (
    not APP.exists()
    or lines < 1000
    or "PLACEHOLDER" in text
    or "raise SystemExit('incomplete')" in text
    or "Temporary marker" in text
)
if not needs:
    print(f"app.py OK ({lines} lines)")
    sys.exit(0)
if not B64.exists():
    print("app.py.b64 missing; cannot restore", file=sys.stderr)
    sys.exit(1)
APP.write_bytes(base64.b64decode(B64.read_text(encoding="ascii")))
print(f"Restored app.py from app.py.b64 ({APP.stat().st_size} bytes)")
