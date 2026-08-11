#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AGENTS_DIR = ROOT / "agents"
RUNNERS_DIR = ROOT / "scripts" / "agents"
OUTPUT = Path(__file__).resolve().parent / "agents.json"

GROUP_RULES = [
    ("implementation-manager", "Core Delivery"),
    ("business-analyst", "Core Delivery"),
    ("solution-architect", "Core Delivery"),
    ("ui-ux-designer", "Core Delivery"),
    ("product-owner", "Core Delivery"),
    ("release-manager", "Core Delivery"),
    ("sme", "Domain SMEs"),
    ("backend", "Engineering"),
    ("frontend", "Engineering"),
    ("devops", "Engineering"),
    ("security", "Engineering"),
    ("qa", "Engineering"),
    ("performance", "Engineering"),
    ("database", "Engineering"),
    ("integration", "Engineering"),
    ("documentation", "Engineering"),
    ("technical-writer", "Engineering"),
    ("test", "Engineering"),
    ("infrastructure", "Engineering"),
]


def infer_group(slug: str) -> str:
    for token, group in GROUP_RULES:
        if token in slug:
            return group
    return "Expanded Delivery"


def title_from_folder(folder_name: str) -> str:
    parts = folder_name.split("-", 1)
    slug = parts[1] if len(parts) > 1 else folder_name
    return slug.replace("-", " ").title()


def parse_agent_name(agent_md: Path, fallback: str) -> str:
    if not agent_md.exists():
        return fallback
    text = agent_md.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"^#\s*Agent\s+\d+\s+[\u2014\-]\s+(.+)$", text, re.MULTILINE)
    if m:
        return m.group(1).strip()
    m = re.search(r"^Role:\s*(.+)$", text, re.MULTILINE)
    if m:
        return m.group(1).strip()
    return fallback


def parse_focus(agent_md: Path) -> str:
    if not agent_md.exists():
        return "No AGENT.md found for this role."
    text = agent_md.read_text(encoding="utf-8", errors="ignore")
    mission = re.search(r"^Mission:\s*(?:\n-\s*(.+))?", text, re.MULTILINE)
    if mission and mission.group(1):
        return mission.group(1).strip()
    for line in text.splitlines():
        if line.startswith("Role:"):
            return line.replace("Role:", "").strip()
    return "See AGENT.md for role details."


def build_prompt(agent_name: str) -> str:
    return f"Give me the top 3 actions for {agent_name} this sprint."


def main() -> None:
    items = []
    for child in sorted(AGENTS_DIR.iterdir()):
        if not child.is_dir() or child.name == "manager":
            continue
        folder = child.name
        parts = folder.split("-", 1)
        agent_id = parts[0]
        slug = parts[1] if len(parts) > 1 else folder
        fallback_name = title_from_folder(folder)
        agent_md = child / "AGENT.md"
        name = parse_agent_name(agent_md, fallback_name)
        focus = parse_focus(agent_md)
        run_script = RUNNERS_DIR / f"run-{slug}.sh"
        generic_command = f"scripts/agents/run-agent.sh {folder}"
        runner_command = f"scripts/agents/{run_script.name}" if run_script.exists() else generic_command

        items.append(
            {
                "id": agent_id,
                "key": slug,
                "folder": folder,
                "name": name,
                "group": infer_group(slug),
                "focus": focus,
                "prompt": build_prompt(name),
                "agentFile": f"agents/{folder}/AGENT.md",
                "runCommand": runner_command,
                "runCommandFallback": generic_command,
                "hasDedicatedRunner": run_script.exists(),
            }
        )

    OUTPUT.write_text(json.dumps(items, indent=2), encoding="utf-8")
    print(f"Wrote {len(items)} agents to {OUTPUT}")


if __name__ == "__main__":
    main()
