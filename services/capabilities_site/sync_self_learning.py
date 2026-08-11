#!/usr/bin/env python3
"""Sync agent self-learning snapshot into web-served folder."""

from __future__ import annotations

import json
from pathlib import Path

SITE_DIR = Path(__file__).resolve().parent
SOURCE = SITE_DIR.parent.parent / "memories" / "repo" / "agent_self_learning_latest.json"
TARGET = SITE_DIR / "agent-self-learning-latest.json"


def main() -> int:
    if not SOURCE.exists():
        raise SystemExit(f"Source not found: {SOURCE}")

    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    TARGET.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Synced {len(payload.get('agents', {}))} agents -> {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
