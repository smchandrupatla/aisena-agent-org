"""Shared helpers for AISENA Selenium GUI tests."""

from __future__ import annotations

from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# Core nav destinations that appear on most pages (href filename -> link text).
CORE_NAV_LINKS: dict[str, str] = {
    "index.html": "Overview",
    "start-project.html": "Create New App",
    "capabilities.html": "Capabilities",
    "wiki.html": "Wiki",
    "documentation.html": "Documentation",
    "tasks.html": "Tasks",
    "issues.html": "Issues",
    "test-dashboard.html": "Test Dashboard",
    "app-dashboard.html": "App Dashboard",
    "postgres-viewer.html": "Postgres Viewer",
    "kafka-viewer.html": "Kafka Viewer",
    "splunk-viewer.html": "Splunk Viewer",
    "dynatrace-viewer.html": "Dynatrace Viewer",
    "agent-learning.html": "Agent Learning",
    "workflow.html": "Workflow",
    "guardrails.html": "Guardrails",
    "agents-admin.html": "Manage Agents",
    "agents-chat.html": "Agents + Chat",
    "agentic-ai-cheatsheet.html": "AI Cheatsheet",
}


def open_page(driver: WebDriver, base_url: str, page: str, timeout: float = 15) -> None:
    url = f"{base_url.rstrip('/')}/{page.lstrip('/')}"
    driver.get(url)
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )
    WebDriverWait(driver, timeout).until(EC.presence_of_element_located((By.TAG_NAME, "body")))


def wait_for(driver: WebDriver, timeout: float = 15) -> WebDriverWait:
    return WebDriverWait(driver, timeout)


def click_nav_link(driver: WebDriver, href: str, timeout: float = 15):
    link = WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, f'nav a[href="{href}"]'))
    )
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", link)
    link.click()
    return link


def safe_click(driver: WebDriver, element) -> None:
    driver.execute_script(
        "arguments[0].scrollIntoView({block:'center', inline:'center'});", element
    )
    element.click()
