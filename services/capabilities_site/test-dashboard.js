// Test Dashboard: renders test plans + test run history from the API
// (/api/test-plans, /api/test-runs, /api/test-summary) and wires the
// "Add Test Plan" / "Log Test Run" dialogs. Mirrors the tasks.js/issues.js
// fetch + render + dialog pattern used elsewhere in this site.

let plansCache = [];
let runsCache = [];

function statusBadge(status) {
  const label = (status || "unknown").replace(/_/g, " ");
  return `<span class="status-badge status-${status || "unknown"}">${escapeHtml(label)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function formatDateTime(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch (err) {
    return iso;
  }
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "-";
  return `${seconds}s`;
}

async function fetchJson(path) {
  try {
    const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

async function fetchPlans() {
  const data = await fetchJson("/api/test-plans");
  return data && Array.isArray(data.plans) ? data.plans : [];
}

async function fetchRuns() {
  const data = await fetchJson("/api/test-runs");
  return data && Array.isArray(data.runs) ? data.runs : [];
}

async function fetchSummary() {
  return (await fetchJson("/api/test-summary")) || {};
}

function setNotice(message, tone) {
  const el = document.getElementById("testDashboardNotice");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("ok", "warn");
  el.classList.add(tone || "ok");
}

function renderSummary(summary) {
  document.getElementById("summaryPlanCount").textContent = summary.plan_count ?? "-";
  document.getElementById("summarySuiteCount").textContent = summary.executed_suite_count ?? "0";
  document.getElementById("summarySuiteDetail").textContent =
    `${summary.passing_suite_count ?? 0} of ${summary.executed_suite_count ?? 0} passing (${summary.suite_count ?? 0} total suites)`;
  const passRate = summary.overall_case_pass_rate;
  document.getElementById("summaryPassRate").textContent = passRate === null || passRate === undefined ? "N/A" : `${passRate}%`;
  document.getElementById("summaryPassRateBar").style.width = `${passRate || 0}%`;
}

function renderPlans(plans) {
  const body = document.getElementById("plansBody");
  if (!plans.length) {
    body.innerHTML = `<tr><td colspan="6">No test plans yet.</td></tr>`;
    return;
  }
  body.innerHTML = plans.map((plan) => {
    const latest = plan.latest_run;
    const latestLabel = latest ? statusBadge(latest.status) : `<span class="status-badge status-not_run">no runs</span>`;
    return `
      <tr>
        <td><strong>${escapeHtml(plan.title)}</strong><br><span class="lede" style="font-size:12px;">${escapeHtml(plan.id)}</span></td>
        <td>${escapeHtml(plan.owner || "Unassigned")}</td>
        <td>${escapeHtml(plan.status)}</td>
        <td>${(plan.suites || []).map((s) => `<span class="pill">${escapeHtml(s)}</span>`).join(" ")}</td>
        <td>${latestLabel}</td>
        <td>${plan.pass_rate === null || plan.pass_rate === undefined ? "-" : `${plan.pass_rate}%`}</td>
      </tr>`;
  }).join("");
}

function renderRuns(runs) {
  const body = document.getElementById("runsBody");
  if (!runs.length) {
    body.innerHTML = `<tr><td colspan="8">No test runs recorded yet.</td></tr>`;
    return;
  }
  body.innerHTML = runs.map((run) => {
    const results = run.total ? `${run.passed ?? 0}/${run.total} passed` : "-";
    return `
      <tr>
        <td>${escapeHtml(run.id)}</td>
        <td><span class="pill">${escapeHtml(run.suite)}</span></td>
        <td>${statusBadge(run.status)}</td>
        <td>${results}</td>
        <td>${formatDuration(run.duration_seconds)}</td>
        <td>${formatDateTime(run.started_at)}</td>
        <td>${escapeHtml(run.triggered_by || "-")}</td>
        <td><button type="button" class="ghost view-run-btn" data-run-id="${escapeHtml(run.id)}">View Cases</button></td>
      </tr>`;
  }).join("");

  body.querySelectorAll(".view-run-btn").forEach((btn) => {
    btn.addEventListener("click", () => showRunDetail(btn.dataset.runId));
  });
}

function showRunDetail(runId) {
  const run = runsCache.find((r) => r.id === runId);
  const card = document.getElementById("runDetailCard");
  const title = document.getElementById("runDetailTitle");
  const list = document.getElementById("runDetailCases");
  if (!run) return;
  card.style.display = "block";
  title.textContent = `${run.id} — ${run.suite} (${run.status})`;
  const cases = run.cases || [];
  list.innerHTML = cases.length
    ? cases.map((c) => `<li><span>${escapeHtml(c.name)}</span>${statusBadge(c.status)}</li>`).join("")
    : `<li><span>${run.notes ? escapeHtml(run.notes) : "No individual case detail recorded for this run."}</span></li>`;
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function populateFilterOptions(runs) {
  const suiteSelect = document.getElementById("filterSuite");
  const runPlanSelect = document.getElementById("runPlan");
  const suites = [...new Set(runs.map((r) => r.suite))].sort();
  suiteSelect.innerHTML = `<option value="">All Suites</option>` +
    suites.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  runPlanSelect.innerHTML = `<option value="">None</option>` +
    plansCache.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.id)} — ${escapeHtml(p.title)}</option>`).join("");
}

function applyRunFilters() {
  const suite = document.getElementById("filterSuite").value;
  const status = document.getElementById("filterStatus").value;
  const filtered = runsCache.filter((r) => {
    if (suite && r.suite !== suite) return false;
    if (status && r.status !== status) return false;
    return true;
  });
  renderRuns(filtered);
}

async function loadDashboard() {
  const [plans, runs, summary] = await Promise.all([fetchPlans(), fetchRuns(), fetchSummary()]);
  plansCache = plans;
  runsCache = runs.sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""));
  renderSummary(summary);
  renderPlans(plansCache);
  renderRuns(runsCache);
  populateFilterOptions(runsCache);
}

function wireDialogs() {
  const planDialog = document.getElementById("planDialog");
  const runDialog = document.getElementById("runDialog");

  document.getElementById("addPlanBtn").addEventListener("click", () => planDialog.showModal());
  document.getElementById("planDialogCancel").addEventListener("click", () => planDialog.close());
  document.getElementById("logRunBtn").addEventListener("click", () => runDialog.showModal());
  document.getElementById("runDialogCancel").addEventListener("click", () => runDialog.close());

  document.getElementById("planForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const suites = document.getElementById("planSuites").value
      .split(",").map((s) => s.trim()).filter(Boolean);
    const response = await fetch(`${API_BASE}/api/test-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: document.getElementById("planTitle").value,
        description: document.getElementById("planDescription").value,
        owner: document.getElementById("planOwner").value,
        status: document.getElementById("planStatus").value,
        suites,
      }),
    });
    if (response.ok) {
      planDialog.close();
      document.getElementById("planForm").reset();
      setNotice("Test plan added.", "ok");
      await loadDashboard();
    } else {
      setNotice("Could not save the test plan.", "warn");
    }
  });

  document.getElementById("runForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const toIntOrNull = (id) => {
      const value = document.getElementById(id).value;
      return value === "" ? null : Number(value);
    };
    const response = await fetch(`${API_BASE}/api/test-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suite: document.getElementById("runSuite").value,
        plan_id: document.getElementById("runPlan").value || null,
        status: document.getElementById("runStatus").value,
        total: toIntOrNull("runTotal"),
        passed: toIntOrNull("runPassed"),
        failed: toIntOrNull("runFailed"),
        duration_seconds: toIntOrNull("runDuration"),
        notes: document.getElementById("runNotes").value,
        triggered_by: "user",
      }),
    });
    if (response.ok) {
      runDialog.close();
      document.getElementById("runForm").reset();
      setNotice("Test run logged.", "ok");
      await loadDashboard();
    } else {
      setNotice("Could not log the test run.", "warn");
    }
  });

  document.getElementById("filterSuite").addEventListener("change", applyRunFilters);
  document.getElementById("filterStatus").addEventListener("change", applyRunFilters);
  document.getElementById("filterClear").addEventListener("click", () => {
    document.getElementById("filterSuite").value = "";
    document.getElementById("filterStatus").value = "";
    applyRunFilters();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  wireDialogs();
  await loadDashboard();
});
