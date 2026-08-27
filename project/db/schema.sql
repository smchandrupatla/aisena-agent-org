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
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS type VARCHAR(20);
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS severity VARCHAR(20);
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS use_case VARCHAR(32);
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS component VARCHAR(255);
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS discovered_by VARCHAR(255);
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS source VARCHAR(40);
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS estimated_effort VARCHAR(2);
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS related_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aisena_tasks ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMP;
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
CREATE INDEX IF NOT EXISTS idx_aisena_tasks_self_learning
    ON aisena_tasks (source, lower(title))
    WHERE source = 'agent_self_learn';

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
    type                VARCHAR(20),
    severity            VARCHAR(20),
    priority            VARCHAR(20),
    use_case            VARCHAR(32),
    component           VARCHAR(255),
    file_path           TEXT,
    discovered_by       VARCHAR(255),
    source              VARCHAR(40),
    labels              JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_effort   VARCHAR(2),
    related_task_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_confirmed_at  TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS type VARCHAR(20);
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS severity VARCHAR(20);
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS priority VARCHAR(20);
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS use_case VARCHAR(32);
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS component VARCHAR(255);
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS discovered_by VARCHAR(255);
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS source VARCHAR(40);
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS labels JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS estimated_effort VARCHAR(2);
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS related_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aisena_issues ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_aisena_issues_app_id ON aisena_issues(app_id);
CREATE INDEX IF NOT EXISTS idx_aisena_issues_status ON aisena_issues(status);
CREATE INDEX IF NOT EXISTS idx_aisena_issues_task_id ON aisena_issues(task_id);
CREATE INDEX IF NOT EXISTS idx_aisena_issues_app_label ON aisena_issues(app_label);
CREATE INDEX IF NOT EXISTS idx_aisena_issues_self_learning
    ON aisena_issues (source, lower(title))
    WHERE source = 'agent_self_learn';

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

-- Prompt Library identity is deliberately scoped to the library until the
-- wider portal adopts a shared identity provider. Deployments can map their
-- authenticated identity header to these records; local development uses the
-- seeded administrator below.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS aisena_users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(320) UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'viewer',
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT aisena_users_role_check CHECK (role IN ('viewer', 'editor', 'admin'))
);

INSERT INTO aisena_users (id, email, display_name, role)
VALUES ('00000000-0000-4000-8000-000000000001', 'local-admin@aisena.local', 'Local Administrator', 'admin')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS aisena_prompts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_code       VARCHAR(32) UNIQUE NOT NULL,
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    prompt_text       TEXT NOT NULL,
    category          VARCHAR(120),
    status            VARCHAR(20) NOT NULL DEFAULT 'Draft',
    owner_user_id     UUID NOT NULL REFERENCES aisena_users(id),
    assignee_agent_id VARCHAR(8) REFERENCES aisena_agents(id) ON DELETE SET NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    usage_count       INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP NOT NULL DEFAULT now(),
    archived_at       TIMESTAMP,
    deleted_at        TIMESTAMP,
    CONSTRAINT aisena_prompts_status_check CHECK (status IN ('Draft', 'Active', 'Archived')),
    CONSTRAINT aisena_prompts_version_check CHECK (version > 0),
    CONSTRAINT aisena_prompts_usage_count_check CHECK (usage_count >= 0)
);

CREATE TABLE IF NOT EXISTS aisena_prompt_tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(80) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aisena_prompt_tags_name
    ON aisena_prompt_tags (lower(name));

CREATE TABLE IF NOT EXISTS aisena_prompt_tag_links (
    prompt_id UUID NOT NULL REFERENCES aisena_prompts(id) ON DELETE CASCADE,
    tag_id    UUID NOT NULL REFERENCES aisena_prompt_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (prompt_id, tag_id)
);

CREATE TABLE IF NOT EXISTS aisena_prompt_versions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id          UUID NOT NULL REFERENCES aisena_prompts(id) ON DELETE CASCADE,
    version            INTEGER NOT NULL,
    title              VARCHAR(255) NOT NULL,
    description        TEXT,
    prompt_text        TEXT NOT NULL,
    category           VARCHAR(120),
    status             VARCHAR(20) NOT NULL,
    assignee_agent_id  VARCHAR(8) REFERENCES aisena_agents(id) ON DELETE SET NULL,
    changed_by_user_id UUID NOT NULL REFERENCES aisena_users(id),
    change_summary     TEXT NOT NULL,
    created_at         TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (prompt_id, version)
);

CREATE TABLE IF NOT EXISTS aisena_prompt_audit (
    id          BIGSERIAL PRIMARY KEY,
    prompt_id   UUID NOT NULL,
    prompt_code VARCHAR(32) NOT NULL,
    user_id     UUID NOT NULL REFERENCES aisena_users(id),
    action      VARCHAR(40) NOT NULL,
    changes     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aisena_prompts_status ON aisena_prompts(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aisena_prompts_owner ON aisena_prompts(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aisena_prompts_assignee ON aisena_prompts(assignee_agent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aisena_prompts_updated ON aisena_prompts(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aisena_prompts_search ON aisena_prompts USING gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' ||
        coalesce(prompt_text, '') || ' ' || coalesce(category, ''))
) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aisena_prompt_tag_links_tag ON aisena_prompt_tag_links(tag_id);
CREATE INDEX IF NOT EXISTS idx_aisena_prompt_versions_prompt ON aisena_prompt_versions(prompt_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_aisena_prompt_audit_prompt ON aisena_prompt_audit(prompt_id, created_at DESC);

-- Per-user viewer preferences (item 8) — persisted per table for filter/sort/column state
CREATE TABLE IF NOT EXISTS aisena_viewer_preferences (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES aisena_users(id) ON DELETE CASCADE,
    table_name      VARCHAR(255) NOT NULL,
    preferences     JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at      TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (user_id, table_name)
);
CREATE INDEX IF NOT EXISTS idx_aisena_viewer_prefs_user ON aisena_viewer_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_aisena_viewer_prefs_table ON aisena_viewer_preferences(table_name);

