"""
Selenium GUI test fixtures for AISENA.

Supports two modes:
  1. Remote WebDriver (Docker Compose): set SELENIUM_REMOTE_URL + SITE_BASE_URL
  2. Local headless Chrome: set SITE_BASE_URL only (or default to local static server)
"""

from __future__ import annotations

import os
import socket
import subprocess
import time
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.remote.webdriver import WebDriver

ROOT = Path(__file__).resolve().parents[2]
CAPABILITIES_SITE = ROOT / "services" / "capabilities_site"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture(scope="session")
def base_url():
    """Base URL of the site under test.

    Priority:
      1. SITE_BASE_URL env (Docker or external server)
      2. Local static HTTP server over services/capabilities_site
    """
    configured = os.environ.get("SITE_BASE_URL", "").strip()
    if configured:
        yield configured.rstrip("/")
        return

    port = _free_port()
    proc = subprocess.Popen(
        ["python", "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=str(CAPABILITIES_SITE),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}"
    # Wait briefly for the server to accept connections.
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                break
        except OSError:
            time.sleep(0.1)
    else:
        proc.kill()
        raise RuntimeError("Local static server failed to start")

    try:
        yield url
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.fixture(scope="session")
def driver() -> WebDriver:
    options = ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1400,900")
    options.add_argument("--disable-extensions")

    remote = os.environ.get("SELENIUM_REMOTE_URL", "").strip()
    if remote:
        driver = webdriver.Remote(command_executor=remote, options=options)
    else:
        # Selenium 4.6+ manages chromedriver automatically when available.
        driver = webdriver.Chrome(options=options)

    driver.set_page_load_timeout(30)
    driver.implicitly_wait(2)
    try:
        yield driver
    finally:
        driver.quit()


@pytest.fixture
def wait(driver):
    from selenium.webdriver.support.ui import WebDriverWait

    return WebDriverWait(driver, 15)
