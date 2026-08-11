# GitHub Capability Demo Project

This is a small sample project to test implementation and bug-fix capabilities quickly.

## What it includes
- FastAPI service with task CRUD endpoints.
- Automated tests using pytest.
- Simple in-memory store for fast local runs.

## Project structure
- `app/main.py`: API implementation.
- `tests/test_api.py`: test suite.
- `requirements.txt`: runtime and test dependencies.

## Run locally
1. Install dependencies:

```bash
python -m pip install -r requirements.txt
```

2. Start API:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

3. Open docs:
- `http://localhost:8090/docs`

## Run tests

```bash
pytest -q
```

## Suggested GitHub flow
1. Create a new repository on GitHub.
2. Copy this folder into that repository or push this repo branch.
3. Run tests in CI on each push/PR.
