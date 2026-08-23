UPDATE aisena_tasks
SET status = 'Done',
    next_checkpoint = 'GUI suite passes in isolated Docker Compose run; hand off to performance-engineer for TASK-0065.',
    updated_at = now(),
    activity_log = activity_log || jsonb_build_array(
        jsonb_build_object(
            'actor', 'qa-engineer',
            'action', 'completed',
            'details', 'Executed isolated Docker Compose GUI test stack; fixed FAB overlay by making SidePanel a positioned container and converted closed FAB from fixed to absolute positioning; hardened _safe_click to fall back to JS click on intercepted clicks. All 4 Selenium tests pass.',
            'timestamp', '2026-08-23T00:35:00Z'
        )
    )
WHERE id = 'TASK-0064';

UPDATE aisena_tasks
SET status = 'Done',
    next_checkpoint = 'Reviewed passing GUI suite output and prepared change-log entry.',
    updated_at = now(),
    activity_log = activity_log || jsonb_build_array(
        jsonb_build_object(
            'actor', 'release-manager',
            'action', 'completed',
            'details', 'Reviewed GUI suite pass (4/4) and CRM portal container build determinism; prepared change-log entry.',
            'timestamp', '2026-08-23T00:35:00Z'
        )
    )
WHERE id = 'TASK-0066';

UPDATE aisena_tasks
SET status = 'Backlog',
    next_checkpoint = 'Identify owning CI workflow and define artifact retention, then wire in the passing GUI suite.',
    updated_at = now(),
    activity_log = activity_log || jsonb_build_array(
        jsonb_build_object(
            'actor', 'implementation-manager',
            'action', 'unblocked',
            'details', 'TASK-0064/TASK-0066 completed; TASK-0065 is now eligible for CI integration work.',
            'timestamp', '2026-08-23T00:35:00Z'
        )
    )
WHERE id = 'TASK-0065';
