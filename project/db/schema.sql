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

-- Upgrade early/local task tables that predate the canonical string ID and
-- JSONB schema without discarding their rows.
ALTER TABLE aisena_tasks DROP CONSTRAINT IF EXISTS aisena_tasks_dependency_fkey;
ALTER TABLE aisena_tasks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE aisena_tasks ALTER COLUMN id TYPE VARCHAR(32) USING (
    CASE
        WHEN id::text ~ '^TASK-[0-9]+$' THEN id::text
        WHEN id::text ~ '^[0-9]+$' THEN 'TASK-' || lpad(id::text, 6, '0')
        ELSE id::text
    END
);
ALTER TABLE aisena_tasks ALTER COLUMN title TYPE TEXT USING title::text;
ALTER TABLE aisena_tasks ALTER COLUMN owner TYPE VARCHAR(255) USING owner::text;
ALTER TABLE aisena_tasks ALTER COLUMN priority TYPE VARCHAR(20) USING priority::text;
ALTER TABLE aisena_tasks ALTER COLUMN dependency TYPE VARCHAR(32) USING (
    CASE
        WHEN dependency::text ~ '^TASK-[0-9]+$' THEN dependency::text
        WHEN dependency::text ~ '^[0-9]+$' THEN 'TASK-' || lpad(dependency::text, 6, '0')
        ELSE NULLIF(dependency::text, '')
    END
);
ALTER TABLE aisena_tasks ALTER COLUMN next_checkpoint TYPE TEXT USING next_checkpoint::text;
ALTER TABLE aisena_tasks ALTER COLUMN tags TYPE JSONB USING (
    CASE
        WHEN tags IS NULL OR btrim(tags::text) = '' THEN '[]'::jsonb
        WHEN tags::text ~ '^\s*\[' THEN tags::text::jsonb
        ELSE to_jsonb(string_to_array(tags::text, ','))
    END
);
ALTER TABLE aisena_tasks ALTER COLUMN comments TYPE JSONB USING (
    CASE
        WHEN comments IS NULL OR btrim(comments::text) = '' THEN '[]'::jsonb
        WHEN comments::text ~ '^\s*\[' THEN comments::text::jsonb
        ELSE jsonb_build_array(comments::text)
    END
);
ALTER TABLE aisena_tasks ALTER COLUMN activity_log TYPE JSONB USING (
    CASE
        WHEN activity_log IS NULL OR btrim(activity_log::text) = '' THEN '[]'::jsonb
        WHEN activity_log::text ~ '^\s*\[' THEN activity_log::text::jsonb
        ELSE jsonb_build_array(activity_log::text)
    END
);
ALTER TABLE aisena_tasks ALTER COLUMN app_label TYPE VARCHAR(255) USING app_label::text;
ALTER TABLE aisena_tasks ALTER COLUMN title SET NOT NULL;
ALTER TABLE aisena_tasks ALTER COLUMN status SET DEFAULT 'Backlog';
ALTER TABLE aisena_tasks ALTER COLUMN priority SET DEFAULT 'Medium';
ALTER TABLE aisena_tasks ALTER COLUMN tags SET DEFAULT '[]'::jsonb;
ALTER TABLE aisena_tasks ALTER COLUMN comments SET DEFAULT '[]'::jsonb;
ALTER TABLE aisena_tasks ALTER COLUMN activity_log SET DEFAULT '[]'::jsonb;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS assignment_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS assignment_method VARCHAR(32);
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS upload_filename TEXT;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP;
ALTER TABLE aisena_tasks ADD CONSTRAINT aisena_tasks_dependency_fkey
    FOREIGN KEY (dependency) REFERENCES aisena_tasks(id) ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_aisena_tasks_status ON aisena_tasks(status);
CREATE INDEX IF NOT EXISTS idx_aisena_tasks_owner ON aisena_tasks(owner);
CREATE INDEX IF NOT EXISTS idx_aisena_tasks_dependency ON aisena_tasks(dependency);
CREATE INDEX IF NOT EXISTS idx_aisena_tasks_app_label ON aisena_tasks(app_label);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aisena_tasks_external_reference
    ON aisena_tasks (lower(external_reference))
    WHERE external_reference IS NOT NULL AND btrim(external_reference) <> '';

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

ALTER TABLE aisena_agents ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE aisena_agents ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE aisena_agents ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aisena_agents ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_aisena_agents_key ON aisena_agents(key);
CREATE INDEX IF NOT EXISTS idx_aisena_agents_group ON aisena_agents(agent_group);

CREATE TABLE IF NOT EXISTS aisena_task_upload_audit (
    id                BIGSERIAL PRIMARY KEY,
    upload_filename   TEXT NOT NULL,
    uploader          TEXT NOT NULL,
    uploaded_at       TIMESTAMP NOT NULL DEFAULT now(),
    task_id           VARCHAR(32) NOT NULL REFERENCES aisena_tasks(id) ON DELETE CASCADE,
    assignment_method VARCHAR(32) NOT NULL,
    assigned_agent    VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_aisena_task_upload_audit_task_id
    ON aisena_task_upload_audit(task_id);
