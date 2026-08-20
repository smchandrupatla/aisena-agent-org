"""Pytest fixtures for the Selenium GUI test suite.

Runs headless Chromium locally inside the test container (apt-installed
chromium + chromium-driver) rather than depending on a separate Selenium Grid
container or a browser installed on the host. Configure via env vars:

- PORTAL_BASE_URL: base URL of the deployed web portal under test (default: http://crm-portal)
"""
import os
import time
import urllib.error
import urllib.request

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

PORTAL_BASE_URL = os.environ.get("PORTAL_BASE_URL", "http://crm-portal").rstrip("/")
CHROME_BIN = os.environ.get("CHROME_BIN", "/usr/bin/chromium")
CHROMEDRIVER_PATH = os.environ.get("CHROMEDRIVER_PATH", "/usr/bin/chromedriver")
PORTAL_READY_TIMEOUT_SECONDS = 60


@pytest.fixture(scope="session", autouse=True)
def wait_for_portal():
    # docker-compose "depends_on" only waits for the container to start, not for
    # nginx to actually be serving requests yet, so poll until it responds.
    deadline = time.monotonic() + PORTAL_READY_TIMEOUT_SECONDS
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            urllib.request.urlopen(PORTAL_BASE_URL + "/", timeout=3)
            return
        except (urllib.error.URLError, ConnectionError) as exc:
            last_error = exc
            time.sleep(1)
    raise RuntimeError(f"Portal at {PORTAL_BASE_URL} never became ready") from last_error


@pytest.fixture
def base_url() -> str:
    return PORTAL_BASE_URL


@pytest.fixture
def driver():
    options = Options()
    options.binary_location = CHROME_BIN
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,900")

    drv = webdriver.Chrome(service=Service(executable_path=CHROMEDRIVER_PATH), options=options)
    drv.implicitly_wait(5)
    yield drv
    drv.quit()
