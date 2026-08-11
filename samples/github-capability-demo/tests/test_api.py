from fastapi.testclient import TestClient

from app.main import TASKS, app

client = TestClient(app)


def setup_function() -> None:
    TASKS.clear()


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_list_tasks() -> None:
    payload = {
        "title": "Build sample app",
        "description": "Create a simple API to show capabilities.",
        "status": "todo",
    }
    created = client.post("/tasks", json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == payload["title"]

    listed = client.get("/tasks")
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["id"] == body["id"]


def test_get_update_delete_task() -> None:
    created = client.post("/tasks", json={"title": "Fix bug", "status": "todo"})
    task_id = created.json()["id"]

    got = client.get(f"/tasks/{task_id}")
    assert got.status_code == 200

    updated = client.patch(
        f"/tasks/{task_id}",
        json={"status": "in_progress", "description": "Working on issue"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"

    deleted = client.delete(f"/tasks/{task_id}")
    assert deleted.status_code == 204

    missing = client.get(f"/tasks/{task_id}")
    assert missing.status_code == 404


def test_not_found_paths() -> None:
    response = client.patch("/tasks/missing-id", json={"status": "done"})
    assert response.status_code == 404
