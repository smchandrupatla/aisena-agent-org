"""Selenium GUI tests for the "Create New Project" stepper flow (crm-portal)."""
import uuid

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def _next_button(driver):
    return driver.find_element(By.XPATH, "//button[normalize-space(text())='Next']")


def test_create_flow_type_step_renders(driver, base_url):
    driver.get(base_url + "/create")

    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//h2[contains(text(), 'What are you creating?')]"))
    )
    for label in ("Web App", "Website", "Portal"):
        card = driver.find_element(By.XPATH, f"//button[.//div[contains(text(), '{label}')]]")
        assert card.is_displayed()

    # Next is disabled until a type is chosen.
    assert _next_button(driver).get_attribute("disabled") == "true"


def test_create_flow_select_type_and_advance_to_basics(driver, base_url):
    driver.get(base_url + "/create")

    web_app_card = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//button[.//div[contains(text(), 'Web App')]]"))
    )
    web_app_card.click()

    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//button[normalize-space(text())='Next']"))
    ).click()

    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//h2[contains(text(), 'Basics')]"))
    )

    name_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder='e.g. Customer Support Portal']")
    unique_name = f"GUI Test Project {uuid.uuid4().hex[:8]}"
    name_input.send_keys(unique_name)

    # Wait for the client-side uniqueness check to settle before asserting Next is enabled.
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//span[contains(text(), 'available')]"))
    )

    next_button = driver.find_element(By.XPATH, "//button[normalize-space(text())='Next']")
    assert next_button.get_attribute("disabled") is None
