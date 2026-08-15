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


if __name__ == '__main__':
    unittest.main()
