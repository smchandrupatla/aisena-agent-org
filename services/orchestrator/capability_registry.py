"""Dynamic expert capability registry.

Design principle 4 of the Autonomous Dev Shop spec: there is no fixed roster.
This registry first tries to match a workstream to one of the existing
persona folders under `agents/` (the bootstrap library of known experts),
and falls back to synthesizing a brand-new persona folder on demand when
nothing fits well enough.
"""
from __future__ import annotations

import re
from pathlib import Path

from models import slugify

_WORD_RE = re.compile(r"[a-z0-9]+")


def _words(text: str) -> set[str]:
    return set(_WORD_RE.findall(text.lower()))


class KnownPersona:
    def __init__(self, persona_id: str, role: str, skills: list[str]):
        self.persona_id = persona_id
        self.role = role
        self.skills = skills

    @property
    def searchable_words(self) -> set[str]:
        return _words(self.role) | {w for s in self.skills for w in _words(s)}


class CapabilityRegistry:
    def __init__(self, agents_dir: Path):
        self.agents_dir = Path(agents_dir)

    def known_personas(self) -> list[KnownPersona]:
        personas: list[KnownPersona] = []
        if not self.agents_dir.exists():
            return personas
        for folder in sorted(self.agents_dir.iterdir()):
            agent_md = folder / "AGENT.md"
            if not folder.is_dir() or not agent_md.exists():
                continue
            role = ""
            try:
                for line in agent_md.read_text(encoding="utf-8").splitlines():
                    if line.startswith("Role:"):
                        role = line[len("Role:"):].strip()
                        break
            except Exception:
                pass
            skills = []
            config_path = folder / "config.json"
            if config_path.exists():
                try:
                    import json

                    skills = json.loads(config_path.read_text(encoding="utf-8")).get("skills", [])
                except Exception:
                    skills = []
            personas.append(KnownPersona(folder.name, role or folder.name, skills))
        return personas

    def match_expert(self, workstream_description: str) -> str | None:
        """Return the persona_id of the best-matching known expert, or None."""
        target_words = _words(workstream_description)
        if not target_words:
            return None
        best_persona = None
        best_score = 0
        for persona in self.known_personas():
            overlap = len(target_words & persona.searchable_words)
            if overlap > best_score:
                best_score = overlap
                best_persona = persona
        return best_persona.persona_id if best_persona and best_score > 0 else None

    def synthesize_expert(self, role_title: str, mission: str) -> str:
        """Create a brand-new specialist persona folder on demand and return its id."""
        slug = slugify(role_title)
        target = self.agents_dir / "dynamic" / slug
        target.mkdir(parents=True, exist_ok=True)
        agent_md = target / "AGENT.md"
        if not agent_md.exists():
            agent_md.write_text(
                f"# Dynamic Agent — {role_title}\n\n"
                f"Role: {role_title}\n\n"
                f"Mission:\n- {mission}\n\n"
                "Origin: synthesized on demand by the Orchestrator because no existing "
                "persona matched the workstream requirements.\n",
                encoding="utf-8",
            )
        config_path = target / "config.json"
        if not config_path.exists():
            config_path.write_text('{"skills": []}\n', encoding="utf-8")
        return f"dynamic/{slug}"
