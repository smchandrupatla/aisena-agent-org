#!/usr/bin/env python3
"""Restore services/api/app.py from checked-in base64 part files if PLACEHOLDER."""
from pathlib import Path
import base64
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "services" / "api" / "app.py"
PART_DIR = ROOT / "services" / "api"
B64_SINGLE = PART_DIR / "app.py.b64"

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

parts = sorted(PART_DIR.glob("app.py.b64.part*"))
if parts:
    b64 = "".join(p.read_text(encoding="ascii") for p in parts)
elif B64_SINGLE.exists():
    b64 = B64_SINGLE.read_text(encoding="ascii")
else:
    print("No app.py.b64 or part files found; cannot restore", file=sys.stderr)
    sys.exit(1)

APP.write_bytes(base64.b64decode(b64))
print(f"Restored app.py ({APP.stat().st_size} bytes, {sum(1 for _ in APP.open())} lines)")
