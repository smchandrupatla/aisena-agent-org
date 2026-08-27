"""GUI element presence and interactive functionality tests."""

from __future__ import annotations

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

from tests.gui.helpers import open_page, safe_click, wait_for


class TestOverviewElements:
    def test_hero_and_capability_cards(self, driver, base_url):
        open_page(driver, base_url, "index.html")
        hero = wait_for(driver).until(EC.presence_of_element_located((By.CSS_SELECTOR, "section.hero")))
        assert hero.find_element(By.CSS_SELECTOR, ".kicker").is_displayed()
        assert hero.find_element(By.TAG_NAME, "h1").is_displayed()
        cards = driver.find_elements(By.CSS_SELECTOR, "article.card")
        assert len(cards) >= 3
        table = driver.find_element(By.CSS_SELECTOR, "table.table")
        assert table.is_displayed()
        headers = [th.text for th in table.find_elements(By.CSS_SELECTOR, "thead th")]
        assert any("Input" in h for h in headers)


class TestTasksPageFunctionality:
    def test_tasks_layout_filters_and_table(self, driver, base_url):
        open_page(driver, base_url, "tasks.html")
        assert wait_for(driver).until(EC.presence_of_element_located((By.TAG_NAME, "h1"))).text
        for element_id in (
            "filterText",
            "filterOwner",
            "filterStatus",
            "filterPriority",
            "filterAppLabel",
            "filterClear",
            "tasksBody",
            "selectAll",
        ):
            el = driver.find_element(By.ID, element_id)
            assert el is not None

        # Filter controls accept input without throwing
        search = driver.find_element(By.ID, "filterText")
        search.clear()
        search.send_keys("regression")
        assert search.get_attribute("value") == "regression"
        driver.find_element(By.ID, "filterClear").click()

    def test_quick_actions_visible(self, driver, base_url):
        open_page(driver, base_url, "tasks.html")
        for btn_id in (
            "quickAddTask",
            "uploadTasksButton",
            "quickAssignOwner",
            "quickSetDependency",
            "quickLogHandoff",
        ):
            btn = wait_for(driver).until(EC.presence_of_element_located((By.ID, btn_id)))
            assert btn.is_displayed()
            assert btn.is_enabled()

    def test_add_task_dialog_open_and_cancel(self, driver, base_url):
        open_page(driver, base_url, "tasks.html")
        add_btn = wait_for(driver).until(EC.element_to_be_clickable((By.ID, "quickAddTask")))
        safe_click(driver, add_btn)
        dialog = wait_for(driver).until(EC.presence_of_element_located((By.ID, "taskDialog")))
        # dialog.open is true when shown; also check form fields
        wait_for(driver).until(EC.visibility_of_element_located((By.ID, "taskTitle")))
        title = driver.find_element(By.ID, "taskTitle")
        title.send_keys("GUI regression task")
        assert "GUI regression" in title.get_attribute("value")

        for field_id in ("taskDescription", "taskOwner", "taskStatus", "taskPriority", "taskCheckpoint"):
            assert driver.find_element(By.ID, field_id).is_displayed()

        cancel = driver.find_element(By.ID, "taskDialogCancel")
        safe_click(driver, cancel)
        # Dialog should close (not open)
        wait_for(driver, 5).until(
            lambda d: not d.execute_script("return document.getElementById('taskDialog').open")
        )

    def test_upload_tasks_dialog_open_and_cancel(self, driver, base_url):
        open_page(driver, base_url, "tasks.html")
        upload_btn = wait_for(driver).until(EC.element_to_be_clickable((By.ID, "uploadTasksButton")))
        safe_click(driver, upload_btn)
        wait_for(driver).until(EC.visibility_of_element_located((By.ID, "taskUploadFile")))
        assert driver.find_element(By.ID, "taskUploadPreview").is_displayed()
        template = driver.find_elements(By.CSS_SELECTOR, "a.upload-template-link")
        assert template, "Upload template download link missing"
        cancel = driver.find_element(By.ID, "taskUploadCancel")
        safe_click(driver, cancel)
        wait_for(driver, 5).until(
            lambda d: not d.execute_script("return document.getElementById('taskUploadDialog').open")
        )

    def test_task_run_dialog_structure(self, driver, base_url):
        open_page(driver, base_url, "tasks.html")
        # Dialog exists in DOM even when closed
        dialog = driver.find_element(By.ID, "taskRunDialog")
        assert dialog.tag_name.lower() == "dialog"
        assert driver.find_element(By.ID, "runActionSelect")
        assert driver.find_element(By.ID, "runModelSelect")
        actions = Select(driver.find_element(By.ID, "runActionSelect"))
        values = [o.get_attribute("value") for o in actions.options if o.get_attribute("value")]
        assert "generate_summary" in values
        assert "suggest_next_steps" in values


class TestIssuesPageFunctionality:
    def test_issues_filters_and_lifecycle(self, driver, base_url):
        open_page(driver, base_url, "issues.html")
        assert driver.find_element(By.ID, "filterText").is_displayed()
        assert driver.find_element(By.ID, "filterSeverity").is_displayed()
        assert driver.find_element(By.ID, "filterIncludeResolved").is_displayed()
        timeline = driver.find_elements(By.CSS_SELECTOR, "ol.timeline li")
        assert len(timeline) >= 4
        assert driver.find_element(By.ID, "reportIssueBtn").is_enabled()

    def test_report_issue_dialog_open_fill_cancel(self, driver, base_url):
        open_page(driver, base_url, "issues.html")
        report = wait_for(driver).until(EC.element_to_be_clickable((By.ID, "reportIssueBtn")))
        safe_click(driver, report)
        wait_for(driver).until(EC.visibility_of_element_located((By.ID, "issueTitle")))
        driver.find_element(By.ID, "issueTitle").send_keys("GUI issue smoke")
        driver.find_element(By.ID, "issueDescription").send_keys("Opened by Selenium suite")
        severity = Select(driver.find_element(By.ID, "issueSeverity"))
        severity.select_by_visible_text("High")
        assert driver.find_element(By.ID, "issueEscalation").is_displayed()
        safe_click(driver, driver.find_element(By.ID, "issueDialogCancel"))
        wait_for(driver, 5).until(
            lambda d: not d.execute_script("return document.getElementById('issueDialog').open")
        )


class TestAgentsChatFunctionality:
    def test_chat_console_elements(self, driver, base_url):
        open_page(driver, base_url, "agents-chat.html")
        for element_id in (
            "agentList",
            "chatAgentName",
            "chatMessages",
            "chatInput",
            "sendChat",
            "clearChat",
            "chatAgentStatus",
            "copyRunCommand",
        ):
            el = wait_for(driver).until(EC.presence_of_element_located((By.ID, element_id)))
            assert el is not None

        assert driver.find_element(By.ID, "sendChat").is_enabled()
        assert driver.find_element(By.ID, "clearChat").is_enabled()

    def test_cross_check_controls(self, driver, base_url):
        open_page(driver, base_url, "agents-chat.html")
        for element_id in (
            "crossCheckPrimaryAgent",
            "crossCheckPeerAgent",
            "crossCheckTurnCap",
            "crossCheckPrompt",
            "runCrossCheck",
            "crossCheckSummary",
        ):
            assert driver.find_element(By.ID, element_id).is_displayed()

        turn_cap = Select(driver.find_element(By.ID, "crossCheckTurnCap"))
        values = [o.get_attribute("value") for o in turn_cap.options]
        assert "2" in values
        prompt = driver.find_element(By.ID, "crossCheckPrompt")
        prompt.clear()
        prompt.send_keys("GUI cross-check prompt")
        assert "GUI cross-check" in prompt.get_attribute("value")

    def test_chat_input_typing(self, driver, base_url):
        open_page(driver, base_url, "agents-chat.html")
        chat = wait_for(driver).until(EC.element_to_be_clickable((By.ID, "chatInput")))
        chat.clear()
        chat.send_keys("Hello from Selenium GUI suite")
        assert "Selenium" in chat.get_attribute("value")


class TestObservabilityViewers:
    def test_splunk_viewer_toolbar(self, driver, base_url):
        open_page(driver, base_url, "splunk-viewer.html")
        viewer = wait_for(driver).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".observability-viewer"))
        )
        assert viewer.get_attribute("data-observability-provider") == "splunk"
        query = viewer.find_element(By.CSS_SELECTOR, ".observability-query input")
        assert query.is_displayed()
        refresh = viewer.find_element(By.CSS_SELECTOR, ".observability-refresh")
        assert refresh.is_displayed()
        # Query is editable
        query.clear()
        query.send_keys("service.namespace=aisena")
        assert "aisena" in query.get_attribute("value")
        # Status / message nodes exist (API may be unconfigured offline)
        assert viewer.find_element(By.CSS_SELECTOR, "[data-observability-status]")
        assert viewer.find_element(By.CSS_SELECTOR, "[data-observability-message]")

    def test_dynatrace_viewer_toolbar(self, driver, base_url):
        open_page(driver, base_url, "dynatrace-viewer.html")
        viewer = wait_for(driver).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".observability-viewer"))
        )
        assert viewer.get_attribute("data-observability-provider") == "dynatrace"
        assert viewer.find_element(By.CSS_SELECTOR, ".observability-refresh").is_displayed()


class TestWorkflowAndGuardrails:
    def test_workflow_page_structure(self, driver, base_url):
        open_page(driver, base_url, "workflow.html")
        assert wait_for(driver).until(EC.presence_of_element_located((By.TAG_NAME, "h1"))).is_displayed()
        cards = driver.find_elements(By.CSS_SELECTOR, "article.card, .card")
        assert len(cards) >= 1

    def test_guardrails_page_structure(self, driver, base_url):
        open_page(driver, base_url, "guardrails.html")
        assert driver.find_element(By.TAG_NAME, "h1").is_displayed()
        main = driver.find_element(By.TAG_NAME, "main")
        assert main.is_displayed()


class TestStartProjectWizard:
    def test_create_app_page_loads_with_form_or_content(self, driver, base_url):
        open_page(driver, base_url, "start-project.html")
        assert driver.find_element(By.TAG_NAME, "main").is_displayed()
        # Page should expose interactive content (form, buttons, or cards)
        interactive = driver.find_elements(
            By.CSS_SELECTOR, "form, button, input, select, textarea, article.card"
        )
        assert len(interactive) >= 1
