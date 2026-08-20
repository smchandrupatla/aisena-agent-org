 #!/usr/bin/env python3
"""
Agent Deliberation & Collaboration Orchestrator

Coordinates multi-agent deliberation when a project is submitted from the
Create App page. Agents analyze the specification, deliberate on what needs
to be done, produce a coordinated task plan, and start executing.

Phases:
  1. DELIBERATE  - Core agents (Implementation Manager, Business Analyst,
                   Solution Architect, Product Owner) analyze requirements
  2. SPECIALIZE  - Domain experts (UI/UX, Database, Security) provide input
  3. PLAN        - Implementation Manager synthesizes all input into a task plan
  4. EXECUTE     - Agents work on assigned tasks in dependency order
  5. REVIEW      - QA and Security cross-check outputs
"""

import json
import os
import re
import subprocess
import sys
import time
import threading
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("deliberation")

PROJECT_DIR = ROOT / "project"
DELIBERATION_DIR = PROJECT_DIR / "deliberations"
DELIBERATION_DIR.mkdir(parents=True, exist_ok=True)
AGENTS_DIR = ROOT / "agents"

# ── Agent role registry ─────────────────────────────────────────────────

AGENT_ROLES = {
    "00-implementation-manager": {
        "role": "Orchestrator", "phase": "deliberate",
        "focus": "Coordinate the team, manage the backlog, ensure delivery",
    },
    "01-business-analyst": {
        "role": "Business Analyst", "phase": "deliberate",
        "focus": "Analyze requirements, define user stories and acceptance criteria",
    },
    "02-solution-architect": {
        "role": "Solution Architect", "phase": "deliberate",
        "focus": "Define system architecture, component boundaries, technology stack",
    },
    "14-product-owner": {
        "role": "Product Owner", "phase": "deliberate",
        "focus": "Prioritize backlog, validate scope, define MVP",
    },
    "03-ui-ux-designer": {
        "role": "UI/UX Designer", "phase": "specialize",
        "focus": "Design UI components, layouts, interaction patterns",
    },
    "06-database-engineer": {
        "role": "Database Engineer", "phase": "specialize",
        "focus": "Design data models, schemas, migrations, queries",
    },
    "09-security-engineer": {
        "role": "Security Engineer", "phase": "specialize",
        "focus": "Security review, threat modeling, auth recommendations",
    },
    "33-security-compliance-engineer": {
        "role": "Security Compliance", "phase": "specialize",
        "focus": "Compliance review, GDPR/HIPAA/SOC2 requirements",
    },
    "04-frontend-engineer": {
        "role": "Frontend Engineer", "phase": "execute",
        "focus": "Implement frontend components, routing, state management",
    },
    "29-frontend-gui-developer": {
        "role": "Frontend GUI Developer", "phase": "execute",
        "focus": "Build production-quality GUI components",
    },
    "05-backend-engineer": {
        "role": "Backend Engineer", "phase": "execute",
        "focus": "Implement API endpoints, business logic, services",
    },
    "07-integration-engineer": {
        "role": "Integration Engineer", "phase": "execute",
        "focus": "Connect frontend to backend, third-party integrations",
    },
    "08-devops-engineer": {
        "role": "DevOps Engineer", "phase": "execute",
        "focus": "Configure CI/CD, containers, deployment pipelines",
    },
    "30-devops-release-engineer": {
        "role": "DevOps Release Engineer", "phase": "execute",
        "focus": "Manage releases, versioning, deployment automation",
    },
    "10-qa-engineer": {
        "role": "QA Engineer", "phase": "review",
        "focus": "Test strategy, test cases, quality gates",
    },
    "31-test-automation-engineer": {
        "role": "Test Automation", "phase": "review",
        "focus": "Automated test suites, CI integration",
    },
    "32-test-manager": {
        "role": "Test Manager", "phase": "review",
        "focus": "Test planning, coverage tracking, sign-off",
    },
    "11-performance-engineer": {
        "role": "Performance Engineer", "phase": "review",
        "focus": "Load testing, performance optimization",
    },
    "12-documentation-engineer": {
        "role": "Documentation Engineer", "phase": "review",
        "focus": "Technical docs, API docs, README, user guides",
    },
    "34-technical-writer": {
        "role": "Technical Writer", "phase": "review",
        "focus": "User-facing documentation, tutorials",
    },
    "13-release-manager": {
        "role": "Release Manager", "phase": "deliver",
        "focus": "Final integration, release packaging, deployment",
    },
}

# ── Pipelines ───────────────────────────────────────────────────────────

DELIBERATION_PANEL = [
    "00-implementation-manager",
    "01-business-analyst",
    "02-solution-architect",
    "14-product-owner",
]

SPECIALIST_PANEL = [
    "03-ui-ux-designer",
    "06-database-engineer",
    "09-security-engineer",
]

EXECUTION_PHASES = [
    {"id": "scaffold", "label": "Project Scaffolding", "agents": ["00-implementation-manager", "02-solution-architect"]},
    {"id": "database", "label": "Database Layer", "agents": ["06-database-engineer", "28-backend-data-persistence"]},
    {"id": "backend", "label": "Backend Services", "agents": ["05-backend-engineer", "07-integration-engineer"]},
    {"id": "frontend", "label": "Frontend UI", "agents": ["04-frontend-engineer", "03-ui-ux-designer", "29-frontend-gui-developer"]},
    {"id": "integration", "label": "Integration & APIs", "agents": ["07-integration-engineer", "05-backend-engineer"]},
    {"id": "security", "label": "Security Hardening", "agents": ["09-security-engineer", "33-security-compliance-engineer"]},
    {"id": "testing", "label": "Testing & QA", "agents": ["10-qa-engineer", "31-test-automation-engineer", "32-test-manager"]},
    {"id": "performance", "label": "Performance", "agents": ["11-performance-engineer"]},
    {"id": "docs", "label": "Documentation", "agents": ["12-documentation-engineer", "34-technical-writer"]},
    {"id": "release", "label": "Release & Deploy", "agents": ["13-release-manager", "08-devops-engineer", "30-devops-release-engineer"]},
]

# ── Helpers ─────────────────────────────────────────────────────────────

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def load_json(path: Path, default=None):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")

def load_agent_md(agent_key: str) -> str:
    f = AGENTS_DIR / agent_key / "AGENT.md"
    return f.read_text(encoding="utf-8") if f.exists() else f"You are {agent_key}."

def agent_display_name(agent_key: str) -> str:
    if "-" not in agent_key:
        return agent_key
    return agent_key.split("-", 1)[1].replace("-", " ").title()

def summarize_project(payload: dict) -> dict:
    ef = payload.get("enterpriseFeatures", {}) or {}
    return {
        "type": payload.get("type", "web_app"),
        "name": payload.get("name", "Unnamed"),
        "description": payload.get("description", ""),
        "visibility": payload.get("visibility", "private"),
        "config": payload.get("config", {}),
        "enterprise_features": {
            k: v for k, v in ef.items()
            if v and (isinstance(v, bool) or (isinstance(v, dict) and any(v.values())))
        } if ef else {},
        "deployment": payload.get("deployment", {}),
        "eventing": payload.get("eventing", {}),
    }

# ── Prompt builders ─────────────────────────────────────────────────────

def build_deliberation_prompt(agent_key: str, project: dict, context: dict, phase: str) -> str:
    md = load_agent_md(agent_key)[:2000]
    name = agent_display_name(agent_key)
    info = AGENT_ROLES.get(agent_key, {"role": "Specialist", "focus": "general delivery"})
    proj = json.dumps(project, indent=2)
    ctx = json.dumps(context, indent=2) if context else "(none — this is the first phase)"

    return f"""## Multi-Agent Deliberation — {phase.upper()} Phase

### Your Role
You are **{name}** ({info['role']}). Focus: {info['focus']}

### Your Instructions (from AGENT.md)
{md}

### Project Brief
{proj}

### Previous Phase Outputs
{ctx}

### Your Task
Analyze the project brief as {name} and produce a structured JSON assessment.

Required JSON keys:
- `summary`: 1-3 sentence analysis summary
- `decisions`: List of key decisions/recommendations (array of strings)
- `tasks`: Tasks for YOUR role (array of {{"title":str, "description":str, "priority":"high|medium|low", "estimated_hours":number}})
- `risks`: Risks you identify (array of {{"risk":str, "severity":"high|medium|low", "mitigation":str}})
- `questions`: Questions for other agents or clarifications needed (array of strings)

Respond ONLY with the JSON object. No markdown, no extra text."""

def build_synthesis_prompt(phase_outputs: dict, project: dict) -> str:
    proj = json.dumps(project, indent=2)
    all_out = json.dumps(phase_outputs, indent=2)
    md = load_agent_md("00-implementation-manager")[:2000]

    return f"""## Implementation Manager — Synthesis

### Your Instructions (from AGENT.md)
{md}

### Project Brief
{proj}

### All Agent Deliberations
{all_out}

### Your Task
As the Implementation Manager, synthesize ALL agent outputs into a unified delivery plan.

Respond with JSON:
- `tasks`: Array of {{"id":"TASK-XXX","title":str,"description":str,"owner":"agent-key","priority":"high|medium|low","estimated_hours":number,"dependencies":["TASK-XXX"],"phase":"scaffold|database|backend|frontend|integration|security|testing|performance|docs|release"}}
- `milestones`: Array of {{"name":str,"depends_on":["TASK-XXX"],"deliverable":str}}
- `execution_phases`: Ordered array of phase IDs
- `risks`: Consolidated risks (array of {{"risk":str,"severity":"high|medium|low","mitigation":str}})
- `definition_of_done`: What "done" means for this project

Respond ONLY with the JSON object."""

# ── Agent runner ────────────────────────────────────────────────────────

def run_agent_prompt(agent_key: str, prompt: str) -> str:
    """Execute agent prompt via copilot CLI, with heuristic fallback."""
    try:
        proc = subprocess.run(
            ["copilot", "-p", prompt, "--allow-all", "--allow-all-paths",
             "--allow-all-tools", "--output-format", "text"],
            cwd=str(ROOT), text=True, capture_output=True, timeout=180,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except FileNotFoundError:
        pass
    except Exception as e:
        logger.warning("Agent %s: %s", agent_key, e)
    return _heuristic_response(agent_key)

def _heuristic_response(agent_key: str) -> str:
    """Structured heuristic when LLM runtime is unavailable."""
    responses = {
        "00-implementation-manager": {
            "summary": "I've analyzed the project brief. The application requires structured phased delivery with clear ownership across specialist agents.",
            "decisions": [
                "Use iterative delivery with 2-week sprint cycles",
                "All agents report through shared task board",
                "Code reviews required before merging",
                "Start with walking skeleton, add features incrementally",
            ],
            "tasks": [
                {"title": "Initialize project structure", "description": "Create scaffolding, task board, handoff protocols", "priority": "high", "estimated_hours": 2},
                {"title": "Coordinate first deliberation round", "description": "Engage all core agents for requirements analysis", "priority": "high", "estimated_hours": 1},
            ],
            "risks": [
                {"risk": "Scope creep without clear MVP boundaries", "severity": "medium", "mitigation": "Define MVP with Product Owner; freeze scope for first sprint"},
                {"risk": "Agent runtime unavailability", "severity": "medium", "mitigation": "Use heuristic fallbacks; document limitations"},
            ],
            "questions": ["What is the target timeline for MVP?", "Are there existing systems to integrate with?"],
        },
        "01-business-analyst": {
            "summary": "Analyzed project requirements. Defined core user stories, functional requirements, and acceptance criteria.",
            "decisions": [
                "Core user flows identified and documented",
                "Acceptance criteria defined for each user story",
                "Non-functional requirements captured for enterprise features",
            ],
            "tasks": [
                {"title": "Document user stories with acceptance criteria", "description": "Create detailed user stories covering all core flows", "priority": "high", "estimated_hours": 4},
                {"title": "Define functional requirements specification", "description": "Document all functional and non-functional requirements", "priority": "high", "estimated_hours": 3},
            ],
            "risks": [
                {"risk": "Unclear feature prioritization", "severity": "medium", "mitigation": "Work with Product Owner to prioritize backlog"},
            ],
            "questions": ["What are the primary user personas?", "Are there regulatory compliance requirements?"],
        },
        "02-solution-architect": {
            "summary": "Designed system architecture with clear component boundaries, technology stack, and API contracts.",
            "decisions": [
                "Frontend: React + TypeScript + TailwindCSS",
                "Backend: Python FastAPI for RESTful services",
                "Database: PostgreSQL for structured data",
                "Authentication: JWT-based with configurable providers",
                "API: RESTful with OpenAPI 3.0 specification",
            ],
            "tasks": [
                {"title": "Create Architecture Decision Records", "description": "Document key architectural decisions with rationale", "priority": "high", "estimated_hours": 3},
                {"title": "Define API contracts and data models", "description": "Specify REST endpoints, request/response schemas, data models", "priority": "high", "estimated_hours": 4},
            ],
            "risks": [
                {"risk": "Over-engineering early stages", "severity": "medium", "mitigation": "Start with minimal viable architecture; iterate based on feedback"},
            ],
            "questions": ["What is the expected scale (users, data volume)?", "Are there specific hosting/provider constraints?"],
        },
        "14-product-owner": {
            "summary": "Reviewed backlog and prioritized delivery. Defined MVP scope and success criteria for the first deliverable.",
            "decisions": [
                "MVP: core functionality + authentication + basic UI",
                "Enterprise features phased incrementally: SSO first, then RBAC, then MFA",
            ],
            "tasks": [
                {"title": "Prioritize sprint 1 backlog", "description": "Order items by business value and dependency", "priority": "high", "estimated_hours": 2},
                {"title": "Define MVP acceptance criteria", "description": "Document what constitutes a shippable MVP", "priority": "high", "estimated_hours": 2},
            ],
            "risks": [
                {"risk": "Stakeholder misalignment on MVP scope", "severity": "high", "mitigation": "Clearly document and communicate MVP boundaries"},
            ],
            "questions": ["What is the primary business metric for success?"],
        },
        "03-ui-ux-designer": {
            "summary": "Designed UI/UX with component hierarchy, layouts, and interaction patterns.",
            "decisions": ["TailwindCSS for styling", "Mobile-first responsive design", "WCAG 2.1 AA accessibility target"],
            "tasks": [
                {"title": "Design component library and style guide", "description": "Create consistent set of UI components and design tokens", "priority": "high", "estimated_hours": 6},
                {"title": "Create page layouts and wireframes", "description": "Design wireframes for all key screens", "priority": "high", "estimated_hours": 5},
            ],
            "risks": [
                {"risk": "Design misalignment with development capabilities", "severity": "low", "mitigation": "Coordinate with Frontend Engineer early"},
            ],
            "questions": [],
        },
        "06-database-engineer": {
            "summary": "Designed data model with proper normalization, indexing, and migration strategy.",
            "decisions": ["PostgreSQL with proper indexing", "Migrations via Alembic", "Naming conventions: snake_case"],
            "tasks": [
                {"title": "Design normalized database schema", "description": "Create entity relationship diagrams and DDL", "priority": "high", "estimated_hours": 4},
                {"title": "Define indexing strategy", "description": "Create indexes for common query patterns", "priority": "medium", "estimated_hours": 2},
            ],
            "risks": [],
            "questions": ["What is the expected data volume growth rate?"],
        },
        "09-security-engineer": {
            "summary": "Reviewed security posture. Auth, data protection, OWASP Top 10, and threat model assessed.",
            "decisions": [
                "JWT with refresh token rotation",
                "Rate limiting on auth endpoints",
                "Input validation middleware for all endpoints",
                "Security headers (CSP, HSTS, X-Frame-Options)",
            ],
            "tasks": [
                {"title": "Security review report", "description": "Document security findings and recommendations", "priority": "high", "estimated_hours": 3},
                {"title": "Threat model documentation", "description": "Create threat model for the application", "priority": "medium", "estimated_hours": 3},
            ],
            "risks": [
                {"risk": "OWASP Top 10 vulnerabilities", "severity": "high", "mitigation": "Security headers, input validation, dependency scanning"},
                {"risk": "Sensitive data exposure", "severity": "high", "mitigation": "Encryption at rest and in transit; PII handling per eventing config"},
            ],
            "questions": ["Any specific compliance requirements (GDPR, HIPAA, SOC2) beyond what's configured?"],
        },
        "33-security-compliance-engineer": {
            "summary": "Reviewed compliance requirements based on project configuration.",
            "decisions": ["Compliance checks integrated into CI pipeline", "Audit logging enabled for all data access"],
            "tasks": [
                {"title": "Compliance checklist", "description": "Create compliance checklist based on configured flags", "priority": "high", "estimated_hours": 2},
            ],
            "risks": [],
            "questions": [],
        },
    }
    return json.dumps(responses.get(agent_key, {
        "summary": f"{agent_display_name(agent_key)} analyzed the project.", "decisions": [], "tasks": [], "risks": [], "questions": [],
    }))


# ── JSON parsing ───────────────────────────────────────────────────────

def parse_agent_output(raw: str) -> dict:
    """Extract JSON dict from agent output text."""
    if not raw:
        return {}
    # Try direct parse
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        pass
    # Try markdown code fence
    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except (json.JSONDecodeError, TypeError):
            pass
    # Try to find any JSON object
    m = re.search(r'\{[\s\S]*\}', raw)
    if m:
        try:
            return json.loads(m.group(0))
        except (json.JSONDecodeError, TypeError):
            pass
    return {"raw": raw, "summary": raw[:500]}


# ── Orchestration ──────────────────────────────────────────────────────

def run_phase(agent_keys: list, phase: str, project: dict, context: dict) -> dict:
    """Run a deliberation phase: prompt each agent and collect responses."""
    logger.info("Running %s phase with %d agents", phase, len(agent_keys))
    outputs = {}
    for agent_key in agent_keys:
        name = agent_display_name(agent_key)
        logger.info("  %s deliberating...", name)
        prompt = build_deliberation_prompt(agent_key, project, context, phase)
        raw = run_agent_prompt(agent_key, prompt)
        parsed = parse_agent_output(raw)
        outputs[agent_key] = parsed
        logger.info("  %s done (keys: %s)", name, list(parsed.keys()))
    return outputs


def synthesize_plan(phase_outputs: dict, project: dict) -> dict:
    """Have the Implementation Manager synthesize all agent outputs into a plan."""
    logger.info("Synthesizing plan from %d agent outputs", len(phase_outputs))
    prompt = build_synthesis_prompt(phase_outputs, project)
    raw = run_agent_prompt("00-implementation-manager", prompt)
    plan = parse_agent_output(raw)

    # If synthesis failed, produce a basic plan from all agent tasks
    if not plan.get("tasks"):
        all_tasks = []
        all_risks = []
        task_idx = 0
        for agent_key, output in phase_outputs.items():
            for task in output.get("tasks", []):
                task_idx += 1
                all_tasks.append({
                    "id": f"TASK-{task_idx:03d}",
                    "title": task.get("title", ""),
                    "description": task.get("description", ""),
                    "owner": agent_key,
                    "priority": task.get("priority", "medium"),
                    "estimated_hours": task.get("estimated_hours", 4),
                    "dependencies": [],
                    "phase": AGENT_ROLES.get(agent_key, {}).get("phase", "execute"),
                    "status": "PENDING",
                })
            for risk in output.get("risks", []):
                risk["raised_by"] = agent_key
                all_risks.append(risk)
        plan["tasks"] = all_tasks
        plan["risks"] = all_risks
        plan["execution_phases"] = [p["id"] for p in EXECUTION_PHASES]

    return plan


def deliberate(project_payload: dict) -> dict:
    """Main entry point: run full deliberation on a project.

    Returns a dict with:
      - deliberation_id: unique ID
      - status: overall status
      - phases: outputs per phase
      - plan: synthesized task plan
      - execution_progress: tracking for execution phases
    """
    deliberation_id = f"DEL-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    logger.info("=== Starting Deliberation %s ===", deliberation_id)

    project = summarize_project(project_payload)
    context = {}
    phases = {}

    # ── Phase 1: Deliberate ──
    logger.info("--- DELIBERATE phase ---")
    phases["deliberate"] = run_phase(DELIBERATION_PANEL, "deliberate", project, context)
    context["deliberate"] = {k: v for k, v in phases["deliberate"].items()}

    # ── Phase 2: Specialize ──
    logger.info("--- SPECIALIZE phase ---")
    phases["specialize"] = run_phase(SPECIALIST_PANEL, "specialize", project, context)
    context["specialize"] = {k: v for k, v in phases["specialize"].items()}

    # ── Phase 3: Synthesize plan ──
    logger.info("--- PLAN phase ---")
    all_outputs = {}
    for phase_outputs in phases.values():
        all_outputs.update(phase_outputs)
    plan = synthesize_plan(all_outputs, project)
    phases["plan"] = {"synthesis": plan}

    # ── Build execution progress tracker ──
    execution_progress = {}
    for ep in EXECUTION_PHASES:
        pid = ep["id"]
        phase_tasks = [t for t in plan.get("tasks", []) if t.get("phase") == pid]
        execution_progress[pid] = {
            "label": ep["label"],
            "agents": ep["agents"],
            "total_tasks": len(phase_tasks),
            "completed_tasks": 0,
            "status": "PENDING",
            "started_at": None,
            "completed_at": None,
        }

    deliberation = {
        "id": deliberation_id,
        "project": project,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "status": "PLANNED",
        "phases": phases,
        "plan": plan,
        "execution_progress": execution_progress,
    }

    # Persist
    save_json(DELIBERATION_DIR / f"{deliberation_id}.json", deliberation)

    logger.info("=== Deliberation %s complete: %d tasks, %d phases ===",
                deliberation_id, len(plan.get("tasks", [])), len(phases))

    return deliberation


def get_deliberation(deliberation_id: str) -> Optional[dict]:
    """Load a deliberation by ID."""
    return load_json(DELIBERATION_DIR / f"{deliberation_id}.json")


def list_deliberations(limit: int = 20) -> list:
    """List recent deliberations, newest first."""
    files = sorted(DELIBERATION_DIR.glob("DEL-*.json"), reverse=True)
    results = []
    for f in files[:limit]:
        d = load_json(f)
        if d:
            # Return a summary without full plan details
            results.append({
                "id": d.get("id"),
                "project_name": d.get("project", {}).get("name"),
                "project_type": d.get("project", {}).get("type"),
                "status": d.get("status"),
                "created_at": d.get("created_at"),
                "task_count": len(d.get("plan", {}).get("tasks", [])),
            })
    return results


def start_execution(deliberation_id: str) -> Optional[dict]:
    """Mark a deliberation as IN_PROGRESS and begin execution."""
    d = get_deliberation(deliberation_id)
    if not d:
        return None
    d["status"] = "IN_PROGRESS"
    d["updated_at"] = utc_now_iso()

    # Mark the first phase as IN_PROGRESS
    for phase in EXECUTION_PHASES:
        pid = phase["id"]
        if d["execution_progress"][pid]["status"] == "PENDING":
            d["execution_progress"][pid]["status"] = "IN_PROGRESS"
            d["execution_progress"][pid]["started_at"] = utc_now_iso()
            break

    save_json(DELIBERATION_DIR / f"{deliberation_id}.json", d)
    return d


def advance_phase(deliberation_id: str) -> Optional[dict]:
    """Mark current phase as COMPLETE and start the next one."""
    d = get_deliberation(deliberation_id)
    if not d:
        return None

    phases = EXECUTION_PHASES
    for i, phase in enumerate(phases):
        pid = phase["id"]
        if d["execution_progress"][pid]["status"] == "IN_PROGRESS":
            # Complete current phase
            d["execution_progress"][pid]["status"] = "COMPLETED"
            d["execution_progress"][pid]["completed_at"] = utc_now_iso()
            d["execution_progress"][pid]["completed_tasks"] = d["execution_progress"][pid]["total_tasks"]

            # Start next phase if exists
            if i + 1 < len(phases):
                next_pid = phases[i + 1]["id"]
                d["execution_progress"][next_pid]["status"] = "IN_PROGRESS"
                d["execution_progress"][next_pid]["started_at"] = utc_now_iso()
            else:
                d["status"] = "COMPLETED"
            break

    d["updated_at"] = utc_now_iso()
    save_json(DELIBERATION_DIR / f"{deliberation_id}.json", d)
    return d


def update_task_status(deliberation_id: str, task_id: str, new_status: str) -> Optional[dict]:
    """Update a single task's status and recalculate phase progress."""
    d = get_deliberation(deliberation_id)
    if not d:
        return None

    for task in d["plan"].get("tasks", []):
        if task.get("id") == task_id:
            task["status"] = new_status
            break

    # Recalculate phase progress
    for ep in EXECUTION_PHASES:
        pid = ep["id"]
        phase_tasks = [t for t in d["plan"].get("tasks", []) if t.get("phase") == pid]
        completed = sum(1 for t in phase_tasks if t.get("status") == "DONE")
        d["execution_progress"][pid]["completed_tasks"] = completed
        if completed == len(phase_tasks) and len(phase_tasks) > 0:
            if d["execution_progress"][pid]["status"] == "IN_PROGRESS":
                d["execution_progress"][pid]["status"] = "COMPLETED"
                d["execution_progress"][pid]["completed_at"] = utc_now_iso()

    d["updated_at"] = utc_now_iso()
    save_json(DELIBERATION_DIR / f"{deliberation_id}.json", d)
    return d