import json
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

import app as app_module
import prompt_api as prompt_api_module
from app import app


class AgentApiTests(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_agent_catalog_endpoint_exists(self):
        response = self.client.get('/api/agents')
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn('agents', payload)
        self.assertGreaterEqual(len(payload['agents']), 1)

    def test_agent_message_endpoint_accepts_question(self):
        response = self.client.post('/api/agents/implementation-manager/message', json={'message': 'Summarize the next step.'})
        self.assertIn(response.status_code, (200, 500))
        if response.status_code == 200:
            payload = response.get_json()
            self.assertIn('reply', payload)

    def test_deliberation_create_list_and_execute_workflow(self):
        planned = {
            'id': 'DEL-TEST',
            'status': 'PLANNED',
            'project': {'name': 'AISENA Agent Organization'},
            'plan': {'tasks': [{'id': 'TASK-001', 'title': 'Coordinate delivery'}]},
            'execution_progress': {},
        }
        started = {**planned, 'status': 'IN_PROGRESS'}

        with patch.object(app_module, 'DELIBERATION_AVAILABLE', True), \
                patch.object(app_module, 'deliberate', return_value=planned) as deliberate_mock, \
                patch.object(app_module, 'list_deliberations', return_value=[{
                    'id': 'DEL-TEST', 'project_name': 'AISENA Agent Organization',
                    'status': 'PLANNED', 'task_count': 1,
                }]), \
                patch.object(app_module, 'start_execution', return_value=started):
            create_response = self.client.post('/api/deliberations', json={
                'name': 'AISENA Agent Organization',
                'type': 'platform',
                'description': 'Coordinate delivery for the current project.',
            })
            list_response = self.client.get('/api/deliberations')
            execute_response = self.client.post('/api/deliberations/DEL-TEST/execute')

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.get_json()['status'], 'PLANNED')
        deliberate_mock.assert_called_once()
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.get_json()['deliberations'][0]['task_count'], 1)
        self.assertEqual(execute_response.status_code, 200)
        self.assertEqual(execute_response.get_json()['status'], 'IN_PROGRESS')

    def test_cross_check_returns_review_context(self):
        response = self.client.post('/api/agents/cross-check', json={
            'primary_agent': 'implementation-manager',
            'peer_agent': 'business-analyst',
            'turn_cap': 1,
            'prompt': 'Review this production plan for risks.',
        })
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn('summary', payload)
        self.assertIn('business analyst', payload['summary'].lower())
        self.assertRegex(payload['summary'], r'RED|AMBER|GREEN')

    def test_task_list_and_create_workflow(self):
        list_response = self.client.get('/api/tasks')
        self.assertEqual(list_response.status_code, 200)
        self.assertIn('tasks', list_response.get_json())

        create_response = self.client.post('/api/tasks', json={
            'title': 'Task workflow smoke test',
            'description': 'Verify the task workflow',
            'owner': 'implementation-manager',
            'status': 'Backlog',
            'priority': 'High',
            'next_checkpoint': 'Review backlog',
            'tags': ['smoke'],
        })
        self.assertEqual(create_response.status_code, 201)
        payload = create_response.get_json()
        self.assertIn('task', payload)
        self.assertEqual(payload['task']['owner'], 'implementation-manager')
        self.assertTrue(payload['task']['id'].startswith('TASK-'))

    def test_issue_workflow_standard_fields_and_comment(self):
        response = self.client.post('/api/issues', json={
            'title': 'Issue workflow smoke test',
            'description': 'Production impact must be reviewed',
            'severity': 'High',
            'owner': 'implementation-manager',
            'mitigation': 'Validate the workflow',
        })
        self.assertEqual(response.status_code, 201)
        issue = response.get_json()['issue']
        self.assertTrue(issue['id'].startswith('ISSUE-'))
        self.assertTrue(issue['escalation_flag'])
        self.assertEqual(issue['status'], 'Open')
        self.assertIn('created_at', issue)
        self.assertIn('activity_log', issue)

        comment_response = self.client.post(f"/api/issues/{issue['id']}/comments", json={
            'author': 'QA',
            'text': 'Comment added',
        })
        self.assertEqual(comment_response.status_code, 201)
        self.assertEqual(len(comment_response.get_json()['issue']['comments']), 1)

    def test_test_plans_endpoint_returns_seeded_plans_enriched_with_latest_run(self):
        response = self.client.get('/api/test-plans')
        self.assertEqual(response.status_code, 200)
        plans = response.get_json()['plans']
        self.assertGreaterEqual(len(plans), 1)
        plan = next(p for p in plans if p['id'] == 'PLAN-0001')
        self.assertIn('latest_run', plan)
        self.assertIn('pass_rate', plan)

    def test_create_test_plan_workflow(self):
        response = self.client.post('/api/test-plans', json={
            'title': 'Smoke test plan',
            'owner': 'qa-engineer',
            'suites': ['smoke-suite'],
        })
        self.assertEqual(response.status_code, 201)
        plan = response.get_json()['plan']
        self.assertTrue(plan['id'].startswith('PLAN-'))
        self.assertEqual(plan['status'], 'Draft')

        update_response = self.client.put(f"/api/test-plans/{plan['id']}", json={'status': 'Active'})
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()['plan']['status'], 'Active')

    def test_test_runs_list_and_filter_by_suite(self):
        response = self.client.get('/api/test-runs', query_string={'suite': 'api-unittest'})
        self.assertEqual(response.status_code, 200)
        runs = response.get_json()['runs']
        self.assertTrue(all(r['suite'] == 'api-unittest' for r in runs))

    def test_create_test_run_workflow(self):
        response = self.client.post('/api/test-runs', json={
            'suite': 'smoke-suite',
            'status': 'passed',
            'total': 3,
            'passed': 3,
            'failed': 0,
        })
        self.assertEqual(response.status_code, 201)
        run = response.get_json()['run']
        self.assertTrue(run['id'].startswith('RUN-'))

        get_response = self.client.get(f"/api/test-runs/{run['id']}")
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.get_json()['run']['suite'], 'smoke-suite')

    def test_test_summary_endpoint(self):
        response = self.client.get('/api/test-summary')
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn('suites', payload)
        self.assertIn('plan_count', payload)

    def test_splunk_viewer_reports_missing_configuration_without_secrets(self):
        with patch.object(app_module, 'SPLUNK_PASSWORD', ''):
            response = self.client.get('/observability/splunk')

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['provider'], 'splunk')
        self.assertEqual(payload['status'], 'not_configured')
        self.assertEqual(payload['events'], [])
        self.assertNotIn('password', payload)

    def test_dynatrace_viewer_reports_missing_configuration_without_secrets(self):
        with patch.object(app_module, 'DYNATRACE_API_URL', ''), patch.object(app_module, 'DYNATRACE_API_TOKEN', ''):
            response = self.client.get('/observability/dynatrace')

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['provider'], 'dynatrace')
        self.assertEqual(payload['status'], 'not_configured')
        self.assertEqual(payload['events'], [])
        self.assertNotIn('token', payload)

    def test_db_tables_groups_aisena_and_application_tables(self):
        connection = MagicMock()
        connection.cursor.return_value.fetchall.return_value = [
            ('aisena_tasks',),
            ('projects',),
            ('users',),
        ]

        with patch.object(app_module.psycopg2, 'connect', return_value=connection):
            response = self.client.get('/db-tables')

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['aisena_tables'], ['aisena_tasks'])
        self.assertEqual(payload['application_tables'], ['projects', 'users'])
        connection.close.assert_called_once()

class PromptApiTests(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        self.created_ids = []
        self.created_user_ids = []
        self.original_local_auth = prompt_api_module.ALLOW_LOCAL_AUTH
        self.original_prompt_executor = prompt_api_module._prompt_executor
        prompt_api_module.ALLOW_LOCAL_AUTH = True

    def tearDown(self):
        prompt_api_module.ALLOW_LOCAL_AUTH = self.original_local_auth
        prompt_api_module._prompt_executor = self.original_prompt_executor
        if app_module.psycopg2 is None:
            return
        connection = app_module.psycopg2.connect(app_module.DSN)
        try:
            cursor = connection.cursor()
            if self.created_ids:
                cursor.execute("DELETE FROM aisena_prompt_audit WHERE prompt_id = ANY(%s::uuid[])", (self.created_ids,))
                cursor.execute("DELETE FROM aisena_prompts WHERE id = ANY(%s::uuid[])", (self.created_ids,))
            if self.created_user_ids:
                cursor.execute("DELETE FROM aisena_users WHERE id = ANY(%s::uuid[])", (self.created_user_ids,))
            connection.commit()
            cursor.close()
        finally:
            connection.close()

    def test_prompt_end_to_end_lifecycle(self):
        marker = uuid4().hex
        prompt_text = "Role: reviewer\n\nKeep   these spaces.\n<script>alert('no')</script>"
        create = self.client.post('/api/prompts', json={
            'title': f'Prompt API lifecycle test {marker}',
            'description': f'Searchable lifecycle fixture {marker}',
            'prompt_text': prompt_text,
            'category': 'Quality',
            'tags': ['Regression', 'API'],
            'status': 'Active',
            'assignee_agent_id': '10',
        })
        self.assertEqual(create.status_code, 201, create.get_data(as_text=True))
        prompt = create.get_json()['prompt']
        self.created_ids.append(prompt['id'])
        self.assertRegex(prompt['prompt_code'], r'^PROMPT-\d{6}$')
        self.assertEqual(prompt['prompt_text'], prompt_text)
        self.assertEqual(prompt['version'], 1)
        self.assertEqual(prompt['usage_count'], 0)

        listed = self.client.get('/api/prompts', query_string={
            'q': marker, 'status': 'Active', 'tag': 'api',
            'sort': 'title', 'direction': 'asc', 'page': 1, 'per_page': 5,
        })
        self.assertEqual(listed.status_code, 200, listed.get_data(as_text=True))
        self.assertEqual(listed.get_json()['pagination']['total'], 1)

        updated_text = prompt_text + "\nFinal line"
        updated = self.client.put(f"/api/prompts/{prompt['id']}", json={
            'title': prompt['title'], 'description': prompt['description'],
            'prompt_text': updated_text, 'category': prompt['category'],
            'tags': prompt['tags'], 'status': prompt['status'],
            'assignee_agent_id': prompt['assignee_agent_id'],
            'change_summary': 'Append final instruction',
        })
        self.assertEqual(updated.status_code, 200, updated.get_data(as_text=True))
        self.assertEqual(updated.get_json()['prompt']['version'], 2)

        versions = self.client.get(f"/api/prompts/{prompt['id']}/versions")
        self.assertEqual([item['version'] for item in versions.get_json()['versions']], [2, 1])
        compared = self.client.get(f"/api/prompts/{prompt['id']}/versions/compare?from=1&to=2")
        self.assertEqual(compared.get_json()['changed_fields'], ['prompt_text'])

        copied = self.client.post(f"/api/prompts/{prompt['id']}/copy")
        self.assertEqual(copied.get_json()['prompt_text'], updated_text)
        self.assertEqual(copied.get_json()['usage_count'], 1)

        duplicated = self.client.post(f"/api/prompts/{prompt['id']}/duplicate")
        self.assertEqual(duplicated.status_code, 201, duplicated.get_data(as_text=True))
        duplicate = duplicated.get_json()['prompt']
        self.created_ids.append(duplicate['id'])
        self.assertTrue(duplicate['title'].endswith(' Copy'))
        self.assertEqual(duplicate['version'], 1)
        self.assertEqual(duplicate['usage_count'], 0)

        archived = self.client.post(f"/api/prompts/{prompt['id']}/archive")
        self.assertEqual(archived.get_json()['prompt']['status'], 'Archived')
        restored = self.client.post(f"/api/prompts/{prompt['id']}/restore")
        self.assertEqual(restored.get_json()['prompt']['status'], 'Draft')
        version_restored = self.client.post(f"/api/prompts/{prompt['id']}/versions/1/restore")
        self.assertEqual(version_restored.get_json()['prompt']['prompt_text'], prompt_text)
        self.assertEqual(version_restored.get_json()['prompt']['version'], 5)

        deleted = self.client.delete(f"/api/prompts/{prompt['id']}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.get(f"/api/prompts/{prompt['id']}").status_code, 404)

        connection = app_module.psycopg2.connect(app_module.DSN)
        try:
            cursor = connection.cursor()
            cursor.execute("SELECT action FROM aisena_prompt_audit WHERE prompt_id = %s", (prompt['id'],))
            actions = {row[0] for row in cursor.fetchall()}
            cursor.close()
        finally:
            connection.close()
        self.assertTrue({'created', 'updated', 'copied', 'duplicated', 'archived', 'restored', 'version_restored', 'deleted'}.issubset(actions))

    def test_prompt_api_requires_an_authenticated_identity(self):
        with patch.object(prompt_api_module, 'ALLOW_LOCAL_AUTH', False):
            response = self.client.get('/api/prompts')
        self.assertEqual(response.status_code, 401)

    def test_authenticated_viewer_cannot_create_prompt(self):
        user_id = str(uuid4())
        self.created_user_ids.append(user_id)
        connection = app_module.psycopg2.connect(app_module.DSN)
        try:
            cursor = connection.cursor()
            cursor.execute(
                "INSERT INTO aisena_users (id, email, display_name, role) VALUES (%s, %s, %s, 'viewer')",
                (user_id, f"viewer-{user_id}@example.test", "Prompt Viewer"),
            )
            connection.commit()
            cursor.close()
        finally:
            connection.close()

        response = self.client.post('/api/prompts', headers={'X-User-Id': user_id}, json={
            'title': 'Forbidden prompt', 'prompt_text': 'Must not be created',
        })

        self.assertEqual(response.status_code, 403)

    def test_prompt_run_executes_assigned_agent_and_counts_only_success(self):
        marker = uuid4().hex
        created = self.client.post('/api/prompts', json={
            'title': f'Runnable prompt {marker}', 'prompt_text': 'Execute this exact prompt',
            'assignee_agent_id': '10',
        }).get_json()['prompt']
        self.created_ids.append(created['id'])

        calls = []

        def successful_executor(agent_id, prompt_text, tool_actions):
            calls.append((agent_id, prompt_text, tool_actions))
            return {'status': 'ready', 'reply': 'Execution complete', 'agent_name': 'QA Engineer'}, 200

        prompt_api_module.configure_prompt_executor(successful_executor)
        response = self.client.post(f"/api/prompts/{created['id']}/run")

        self.assertEqual(response.status_code, 200)
        result = response.get_json()['result']
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(result['reply'], 'Execution complete')
        self.assertEqual(result['usage_count'], 1)
        self.assertEqual(calls, [('10', 'Execute this exact prompt', [])])

        prompt_api_module.configure_prompt_executor(
            lambda *_: ({'status': 'blocked', 'reply': 'Guardrail blocked execution'}, 200)
        )
        batch = self.client.post('/api/prompts/run', json={'prompt_ids': [created['id']]})

        self.assertEqual(batch.status_code, 200)
        self.assertEqual(batch.get_json()['summary'], {'selected': 1, 'succeeded': 0, 'failed': 1})
        detail = self.client.get(f"/api/prompts/{created['id']}").get_json()['prompt']
        self.assertEqual(detail['usage_count'], 1)

        connection = app_module.psycopg2.connect(app_module.DSN)
        try:
            cursor = connection.cursor()
            cursor.execute("SELECT action FROM aisena_prompt_audit WHERE prompt_id = %s", (created['id'],))
            actions = [row[0] for row in cursor.fetchall()]
            cursor.close()
        finally:
            connection.close()
        self.assertIn('executed', actions)
        self.assertIn('execution_blocked', actions)

    def test_prompt_run_requires_an_assigned_agent(self):
        created = self.client.post('/api/prompts', json={
            'title': f'Unassigned prompt {uuid4().hex}', 'prompt_text': 'Cannot run yet',
        }).get_json()['prompt']
        self.created_ids.append(created['id'])

        response = self.client.post(f"/api/prompts/{created['id']}/run")

        self.assertEqual(response.status_code, 400)
        self.assertIn('Assign an agent', response.get_json()['result']['error'])


if __name__ == '__main__':
    unittest.main()
