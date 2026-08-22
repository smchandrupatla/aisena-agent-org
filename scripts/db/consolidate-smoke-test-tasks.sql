-- Consolidate duplicate "Task workflow smoke test" tasks
-- Created by Implementation Manager, 2026-08-22

UPDATE aisena_tasks
SET description = 'Canonical task workflow smoke test: verify task creation, read, update, comment, and status-transition paths through the Implementation Manager API.',
    updated_at = now(),
    activity_log = activity_log || jsonb_build_array(jsonb_build_object(
        'timestamp', to_jsonb(now()),
        'actor', 'implementation-manager',
        'action', 'consolidated',
        'details', 'Marked as the canonical task workflow smoke test; duplicates TASK-0002, TASK-0067, TASK-0068 consolidated here.'
    ))
WHERE id = 'TASK-0001';

UPDATE aisena_tasks
SET status = 'Done',
    description = 'Duplicate smoke-test artifact created during API workflow validation. Consolidated into TASK-0001; no independent work required.',
    updated_at = now(),
    activity_log = activity_log || jsonb_build_array(jsonb_build_object(
        'timestamp', to_jsonb(now()),
        'actor', 'implementation-manager',
        'action', 'consolidated',
        'details', 'Closed as duplicate of TASK-0001.'
    ))
WHERE id IN ('TASK-0002', 'TASK-0067', 'TASK-0068');
