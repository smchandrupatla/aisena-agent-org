import io
import unittest

from openpyxl import Workbook
from task_upload import build_preview, parse_upload, template_csv
from werkzeug.datastructures import FileStorage


class TaskUploadTests(unittest.TestCase):
    def test_rejects_client_supplied_task_id(self):
        upload = FileStorage(
            stream=io.BytesIO(b"task_id,title\nTASK-999999,Unsafe\n"),
            filename="tasks.csv",
        )

        with self.assertRaisesRegex(ValueError, "task_id column is not accepted"):
            parse_upload(upload)

    def test_parses_xlsx_new_task_columns(self):
        workbook = Workbook()
        sheet = workbook.active
        sheet.append([
            "title", "description", "owner", "status", "priority",
            "dependency", "next_checkpoint", "tags", "app_label",
        ])
        sheet.append([
            "XLSX task", "Imported workbook", "", "Planned", "Low",
            "TASK-000001", "Review draft", "docs;weekly", "AISENA Portal",
        ])
        content = io.BytesIO()
        workbook.save(content)
        upload = FileStorage(
            stream=io.BytesIO(content.getvalue()),
            filename="tasks.xlsx",
        )

        rows = parse_upload(upload)

        self.assertEqual(rows[0]["title"], "XLSX task")
        self.assertEqual(rows[0]["dependency"], "TASK-000001")
        self.assertEqual(rows[0]["app_label"], "AISENA Portal")

    def test_template_contains_new_task_columns(self):
        self.assertTrue(template_csv().startswith(
            "title,description,owner,status,priority,dependency,next_checkpoint,tags,app_label"
        ))

    def test_assigns_by_workload_then_wait_time(self):
        agents = [
            {
                "key": "agent-alpha", "name": "Agent Alpha", "active": True,
                "available": True, "runtime_available": True,
                "last_assigned_at": "2026-08-20T00:00:00+00:00",
            },
            {
                "key": "agent-beta", "name": "Agent Beta", "active": True,
                "available": True, "runtime_available": True,
                "last_assigned_at": "2026-08-19T00:00:00+00:00",
            },
        ]
        existing = [{
            "id": "TASK-000001", "title": "Existing task",
            "owner": "agent-alpha", "status": "In Progress",
        }]
        rows = [{
            "title": "Research findings", "description": "", "owner": "",
            "status": "To Do", "priority": "High", "dependency": "",
            "next_checkpoint": "Review findings", "tags": "research,analysis",
            "app_label": "AISENA Portal",
        }]

        preview = build_preview(rows, existing, agents)

        self.assertEqual(preview[0]["owner"], "agent-beta")
        self.assertEqual(preview[0]["assignment_method"], "automatic")
        self.assertEqual(preview[0]["tags"], ["research", "analysis"])
        self.assertEqual(preview[0]["errors"], [])

    def test_flags_invalid_duplicate_and_dependency(self):
        rows = [{
            "title": "Existing task", "description": "", "owner": "",
            "status": "Queued", "priority": "Extreme",
            "dependency": "TASK-999999", "next_checkpoint": "",
            "tags": "", "app_label": "",
        }]
        existing = [{
            "id": "TASK-000001", "title": "Existing task",
            "status": "Done", "owner": "",
        }]

        preview = build_preview(rows, existing, [])

        self.assertTrue(preview[0]["duplicate"])
        self.assertGreaterEqual(len(preview[0]["errors"]), 3)
        self.assertFalse(preview[0]["assignment_required"])

    def test_preserves_new_task_fields_for_import_revalidation(self):
        agents = [{
            "key": "agent-alpha", "name": "Agent Alpha", "active": True,
            "available": True, "runtime_available": True,
            "last_assigned_at": None,
        }]
        existing = [{
            "id": "TASK-000001", "title": "Existing task",
            "status": "Done", "owner": "",
        }]
        rows = [{
            "title": "Prepare release", "description": "Release detail",
            "owner": "Agent Alpha", "status": "Planned",
            "priority": "Critical", "dependency": "TASK-000001",
            "next_checkpoint": "Approve release", "tags": "release;urgent",
            "app_label": "CRM Portal",
        }]

        preview = build_preview(rows, existing, agents)
        revalidated = build_preview([preview[0]], existing, agents)

        self.assertEqual(revalidated[0]["errors"], [])
        self.assertEqual(revalidated[0]["owner"], "agent-alpha")
        self.assertEqual(revalidated[0]["dependency"], "TASK-000001")
        self.assertEqual(revalidated[0]["next_checkpoint"], "Approve release")
        self.assertEqual(revalidated[0]["app_label"], "CRM Portal")


if __name__ == "__main__":
    unittest.main()
