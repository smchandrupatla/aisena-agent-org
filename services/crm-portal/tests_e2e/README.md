# crm-portal GUI tests (Selenium)

Selenium-based end-to-end GUI tests for the AISENA web portal (`services/crm-portal`).
Tests run against headless Chromium inside the test container (apt-installed
`chromium` + `chromium-driver`), so no browser or driver needs to be installed
on the host, and there's no dependency on the large `selenium/standalone-chrome`
Grid image.

## Layout

- `conftest.py` — pytest fixtures: `driver` (local headless Chrome WebDriver) and `base_url`.
- `test_dashboard.py` — dashboard loads, "New" button navigates to the create flow.
- `test_create_project_flow.py` — "Create New Project" stepper: type selection, Basics
  step validation/name-uniqueness check.
- `Dockerfile` / `requirements.txt` — throwaway test-runner image (Python + pytest + selenium + chromium).

## Running

From the repo root, via the top-level `docker-compose.selenium.yml` (builds the portal
and runs the tests against it in an isolated `aisena-gui-tests` project):

```powershell
docker compose -f docker-compose.selenium.yml up --build --abort-on-container-exit --exit-code-from gui-tests
docker compose -f docker-compose.selenium.yml down -v
```

Or use the helper script: `scripts/run-gui-tests.ps1`.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORTAL_BASE_URL` | `http://crm-portal` | Base URL of the portal under test |
| `CHROME_BIN` | `/usr/bin/chromium` | Chromium binary path |
| `CHROMEDRIVER_PATH` | `/usr/bin/chromedriver` | chromedriver binary path |

To point the suite at a different environment (e.g. a portal already running on the host),
override `PORTAL_BASE_URL` when invoking `pytest` directly.
