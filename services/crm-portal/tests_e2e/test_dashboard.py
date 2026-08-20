"""Selenium GUI tests for the AISENA web portal dashboard (crm-portal)."""
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def test_dashboard_loads_with_title_and_header(driver, base_url):
    driver.get(base_url + "/")

    WebDriverWait(driver, 10).until(EC.title_contains("AISENA Portal"))
    header = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//div[contains(text(), 'AISENA Portal')]"))
    )
    assert header.is_displayed()


def test_new_button_navigates_to_create_flow(driver, base_url):
    driver.get(base_url + "/")

    new_link = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//a[@href='/create']"))
    )
    new_link.click()

    WebDriverWait(driver, 10).until(EC.url_contains("/create"))
    heading = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//div[contains(text(), 'Create New Project')]"))
    )
    assert heading.is_displayed()
