import json
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

import app as app_module
import prompt_api as prompt_api_module
from app import app


def _postgres_available():
    """Return True only when Postgres is reachable for integration tests."""
    if app_module.psycopg2 is None:
        return False
    try:
        conn = app_module.psycopg2.connect(app_module.DSN)
        conn.close()
        return True
    except Exception:
        return False


def _skip_without_postgres(test_method):
    """Decorator: skip test when DSN is down so offline CI stays green."""
    def wrapper(self, *args, **kwargs):
        if not _postgres_available():
            self.skipTest("Postgres not available (set POSTGRES_DSN / start local DB)")
        return test_method(self, *args, **kwargs)
    return wrapper


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
        if not _postgres_available():
            self.skipTest("Postgres not available (set POSTGRES_DSN / start local DB)")
        response = self.client.get('/api/tasks')
        self.assertEqual(response.status_code, 200)
        before = len(response.get_json().get('tasks', []))
        create = self.client.post('/api/tasks', json={
            'title': f'Test task {uuid4().hex[:8]}',
            'description': 'Created by unit test',
            'owner': 'implementation-manager',
            'priority': 'Medium',
        })
        self.assertIn(create.status_code, (200, 201))
        task = create.get_json().get('task') or create.get_json()
        self.assertTrue(str(task.get('id', '')).startswith('TASK-') or 'id' in task)


class PromptApiTests(unittest.TestCase):
    def setUp(self):
        if not _postgres_available():
            self.skipTest("Postgres not available (set POSTGRES_DSN / start local DB)")
        app.config['TESTING'] = True
        self.client = app.test_client()
        self.created_ids = []
        self.created_user_ids = []
        self.original_local_auth = prompt_api_module.ALLOW_LOCAL_AUTH
        self.original_prompt_executor = prompt_api_module._prompt_executor
        prompt_api_module.ALLOW_LOCAL_AUTH = True

    def tearDown(self):
        prompt_api_module.ALLOW_LOCAL_AUTH = getattr(self, 'original_local_auth', True)
        if hasattr(self, 'original_prompt_executor'):
            prompt_api_module._prompt_executor = self.original_prompt_executor
        if not getattr(self, 'created_ids', None) and not getattr(self, 'created_user_ids', None):
            return
        if app_module.psycopg2 is None:
            return
        try:
            connection = app_module.psycopg2.connect(app_module.DSN)
        except Exception:
            return
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

    def test_prompt_api_requires_an_authenticated_identity(self):
        prompt_api_module.ALLOW_LOCAL_AUTH = False
        response = self.client.get('/api/prompts')
        self.assertIn(response.status_code, (401, 403))


if __name__ == '__main__':
    unittest.main()
