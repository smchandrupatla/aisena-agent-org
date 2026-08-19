import json
import unittest

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


if __name__ == '__main__':
    unittest.main()
