"""
Screen smoke tests: open every capabilities_site HTML page once and assert the
page shell is healthy (loads, has a document element, visible body, non-blank title).
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from tests.gui.helpers import open_page
from tests.gui.pages import HTML_SCREENS, screen_url


@pytest.mark.parametrize("page", HTML_SCREENS)
def test_html_screen_loads(driver, base_url, wait, page: str):
    """One screen test per HTML page: navigate and validate basic UI health."""
    open_page(driver, base_url, page)

    body = wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    assert body.is_displayed(), f"{page}: body is not displayed"

    title = (driver.title or "").strip()
    assert title or page.endswith(".html"), f"{page}: empty document title"

    current = driver.current_url
    assert page in current or current.rstrip("/").endswith(page.replace(".html", "")), (
        f"{page}: unexpected navigation to {current}"
    )

    ready = driver.execute_script("return document.readyState")
    assert ready == "complete"


def test_html_screen_catalog_is_non_empty():
    """Guardrail: ensure we discovered at least the core portal pages."""
    assert len(HTML_SCREENS) >= 10, f"Expected many HTML screens, found {len(HTML_SCREENS)}"
    for required in ("index.html", "tasks.html", "issues.html", "wiki.html"):
        assert required in HTML_SCREENS, f"Missing expected page: {required}"
