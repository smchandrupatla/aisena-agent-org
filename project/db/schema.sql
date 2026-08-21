-- Task and issue tracking schema for the shared "aisena" Postgres database.
--
-- Tables are prefixed with `aisena_` to avoid name collisions with the
-- Redmine schema (which already owns `issues`, `projects`, etc.) that lives
-- in the same database (see docker-compose.yml `redmine` service).
--
-- aisena_tasks mirrors the structure of project/tasks.json (the canonical
-- task log used by scripts/import-test-framework-backlog.ps1 and the
-- Implementation Manager workflow).
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
    dependency      VARCHAR(32) REFERENCES aisena_tasks(id) ON DELETE SET NULL,
    next_checkpoint TEXT,
    tags            JSONB NOT NULL DEFAULT '[]'::jsonb,
    comments        JSONB NOT NULL DEFAULT '[]'::jsonb,
    activity_log    JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aisena_tasks_status ON aisena_tasks(status);
CREATE INDEX IF NOT EXISTS idx_aisena_tasks_owner ON aisena_tasks(owner);
CREATE INDEX IF NOT EXISTS idx_aisena_tasks_dependency ON aisena_tasks(dependency);

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
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aisena_issues_app_id ON aisena_issues(app_id);
CREATE INDEX IF NOT EXISTS idx_aisena_issues_status ON aisena_issues(status);
CREATE INDEX IF NOT EXISTS idx_aisena_issues_task_id ON aisena_issues(task_id);
