import json
import unittest
from unittest.mock import patch

import app as app_module
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


if __name__ == '__main__':
    unittest.main()
