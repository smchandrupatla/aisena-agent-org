UPDATE aisena_tasks
SET status = 'Done',
    next_checkpoint = 'Container build is deterministic and verified; hand off to QA for TASK-0064.',
    updated_at = now(),
    activity_log = activity_log || '[{"actor": "frontend-engineer", "action": "completed", "details": "Pinned base images by digest, switched Dockerfile to npm ci, updated .dockerignore and e2e Dockerfile, verified image builds and nginx starts.", "timestamp": "2026-08-22T12:55:00Z"}]'::jsonb
WHERE id = 'TASK-0063';

UPDATE aisena_tasks
SET status = 'Backlog',
    next_checkpoint = 'Execute isolated Docker Compose GUI test stack and triage first failing test.',
    updated_at = now(),
    activity_log = activity_log || '[{"actor": "implementation-manager", "action": "unblocked", "details": "Dependency TASK-0063 completed; TASK-0064 is now eligible for execution.", "timestamp": "2026-08-22T12:55:00Z"}]'::jsonb
WHERE id = 'TASK-0064';
