"""Shared fixtures for crm-portal Selenium tests (legacy / optional portal flow)."""

from __future__ import annotations

import os

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions


@pytest.fixture(scope="session")
def base_url():
    return os.environ.get("PORTAL_BASE_URL", "http://127.0.0.1:80").rstrip("/")


@pytest.fixture(scope="session")
def driver():
    options = ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1400,900")

    remote = os.environ.get("SELENIUM_REMOTE_URL", "").strip()
    if remote:
        drv = webdriver.Remote(command_executor=remote, options=options)
    else:
        drv = webdriver.Chrome(options=options)

    drv.set_page_load_timeout(30)
    try:
        yield drv
    finally:
        drv.quit()
