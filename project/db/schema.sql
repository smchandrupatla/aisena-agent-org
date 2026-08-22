-- Task and issue tracking schema for the shared "aisena" Postgres database.
--
-- Tables are prefixed with `aisena_` to avoid name collisions with the
-- Redmine schema (which already owns `issues`, `projects`, etc.) that lives
-- in the same database (see docker-compose.yml `redmine` service).
--
-- aisena_tasks is the canonical task log for the Implementation Manager
-- workflow (services/api/app.py /api/tasks endpoints). It replaces the
-- legacy project/tasks.json file store; the dependency FK is deferrable so
-- callers can bulk-replace the table contents within a single transaction
-- without hitting self-referential FK ordering issues.
--
-- aisena_issues mirrors the Ticket model used by services/orchestrator
-- (services/orchestrator/models.py) for per-app blockers/escalations that
-- need a human decision, optionally linked back to a task and/or a
-- GitHub issue number.

CREATE TABLE IF NOT EXISTS aisena_tasks (
    id              VARCHAR(32) PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT,
    owner           VARCHAR(255),
    status          VARCHAR(50) NOT NULL DEFAULT 'Backlog',
    priority        VARCHAR(20) NOT NULL DEFAULT 'Medium',
    dependency      VARCHAR(32) REFERENCES aisena_tasks(id) ON DELETE SET NULL
                        DEFERRABLE INITIALLY DEFERRED,
    next_checkpoint TEXT,
    tags            JSONB NOT NULL DEFAULT '[]'::jsonb,
    comments        JSONB NOT NULL DEFAULT '[]'::jsonb,
    activity_log    JSONB NOT NULL DEFAULT '[]'::jsonb,
    app_label       VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aisena_tasks_status ON aisena_tasks(status);
CREATE INDEX IF NOT EXISTS idx_aisena_tasks_owner ON aisena_tasks(owner);
CREATE INDEX IF NOT EXISTS idx_aisena_tasks_dependency ON aisena_tasks(dependency);
CREATE INDEX IF NOT EXISTS idx_aisena_tasks_app_label ON aisena_tasks(app_label);

CREATE TABLE IF NOT EXISTS aisena_issues (
    id                  VARCHAR(32) PRIMARY KEY,
    app_id              VARCHAR(255),
    task_id             VARCHAR(32) REFERENCES aisena_tasks(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    attempted           TEXT,
    why_blocked         TEXT,
    decision_needed     TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'open',
    github_issue_number INTEGER,
    app_label           VARCHAR(255),
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aisena_issues_app_id ON aisena_issues(app_id);
CREATE INDEX IF NOT EXISTS idx_aisena_issues_status ON aisena_issues(status);
CREATE INDEX IF NOT EXISTS idx_aisena_issues_task_id ON aisena_issues(task_id);
CREATE INDEX IF NOT EXISTS idx_aisena_issues_app_label ON aisena_issues(app_label);

-- aisena_agents is the canonical agent directory for the Implementation
-- Manager workflow (services/api/app.py /api/agents endpoints). It replaces
-- the legacy services/capabilities_site/agents.json catalog file. `content`
-- holds the full AGENT.md markdown body so the web-based agent editor can
-- read/write role definitions without touching the filesystem. The column
-- is named `agent_group` (not `group`, a reserved word) but is exposed as
-- `group` in the JSON API for frontend compatibility.
CREATE TABLE IF NOT EXISTS aisena_agents (
    id                    VARCHAR(8) PRIMARY KEY,
    key                   VARCHAR(255) UNIQUE NOT NULL,
    folder                VARCHAR(255) NOT NULL,
    name                  TEXT NOT NULL,
    agent_group           VARCHAR(255),
    focus                 TEXT,
    prompt                TEXT,
    agent_file            VARCHAR(255),
    run_command           TEXT,
    run_command_fallback  TEXT,
    has_dedicated_runner  BOOLEAN NOT NULL DEFAULT false,
    content               TEXT,
    created_at            TIMESTAMP NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aisena_agents_key ON aisena_agents(key);
CREATE INDEX IF NOT EXISTS idx_aisena_agents_group ON aisena_agents(agent_group);

