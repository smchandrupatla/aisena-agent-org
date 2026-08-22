const ISSUE_SEVERITIES = ["Low", "Medium", "High", "Critical"];
const ISSUE_STATUSES = ["Open", "Triaged", "Mitigating", "Monitoring", "Verifying", "Resolved"];

let issuesCache = [];
let agentsCache = [];

async function fetchIssues() {
  const response = await fetch(`${API_BASE}/api/issues`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load issues");
  const data = await response.json();
  return Array.isArray(data) ? data : data.issues || [];
}

function ownerLabel(key) {
  const agent = agentsCache.find((item) => item.key === key || item.name === key);
  return agent ? agent.name : key || "Unassigned";
}

function filtersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return { q: params.get("q") || "", owner: params.get("owner") || "", severity: params.get("severity") || "", status: params.get("status") || "", resolved: params.get("resolved") === "1" };
}

function readFilters() {
  return { q: document.getElementById("filterText").value.trim(), owner: document.getElementById("filterOwner").value, severity: document.getElementById("filterSeverity").value, status: document.getElementById("filterStatus").value, resolved: document.getElementById("filterIncludeResolved").checked };
}

function syncFilters(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value && !(key === "resolved" && !value)) params.set(key, key === "resolved" ? "1" : value); });
  window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
}

function filteredIssues(filters) {
  const query = filters.q.toLowerCase();
  return issuesCache.filter((issue) => {
    if (!filters.resolved && issue.status === "Resolved") return false;
    if (query && !`${issue.title} ${issue.description || ""}`.toLowerCase().includes(query)) return false;
    if (filters.owner && issue.owner !== filters.owner) return false;
    if (filters.severity && issue.severity !== filters.severity) return false;
    if (filters.status && issue.status !== filters.status) return false;
    return true;
  });
}

function setNotice(message, tone = "ok") {
  const notice = document.getElementById("issuesNotice");
  notice.textContent = message;
  notice.classList.remove("ok", "warn");
  notice.classList.add(tone);
}

function escalationPreview() {
  const text = ["issueTitle", "issueDescription", "issueMitigation"].map((id) => document.getElementById(id).value).join(" ").toLowerCase();
  return Boolean(document.getElementById("issueEscalation").checked) || ["production", "legal", "pricing", "user data", "userdata"].some((term) => text.includes(term));
}

function renderIssues() {
  const filters = readFilters();
  syncFilters(filters);
  const body = document.getElementById("issuesBody");
  const issues = filteredIssues(filters);
  body.innerHTML = issues.length ? issues.map((issue) => `<tr>
    <td><a class="task-link" href="issue.html?id=${encodeURIComponent(issue.id)}">${issue.id} ${escapeHtml(issue.title)}</a></td>
    <td>${issue.severity}</td><td>${escapeHtml(ownerLabel(issue.owner))}</td>
    <td><span class="pill">${issue.status}</span></td><td>${escapeHtml(issue.mitigation || "-")}</td>
    <td><a class="ghost" href="issue.html?id=${encodeURIComponent(issue.id)}" style="text-decoration:none;display:inline-block;">Open</a></td>
  </tr>`).join("") : `<tr><td colspan="6">No issues match this view. Use "Report Issue" to log one.</td></tr>`;
}

function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value || ""; return div.innerHTML; }

function populateSelects() {
  document.getElementById("filterOwner").innerHTML = `<option value="">All Owners</option>${agentsCache.map((a) => `<option value="${a.key}">${a.name}</option>`).join("")}`;
  document.getElementById("filterSeverity").innerHTML = `<option value="">All Severities</option>${ISSUE_SEVERITIES.map((s) => `<option>${s}</option>`).join("")}`;
  document.getElementById("filterStatus").innerHTML = `<option value="">All Statuses</option>${ISSUE_STATUSES.map((s) => `<option>${s}</option>`).join("")}`;
  const filters = filtersFromUrl();
  document.getElementById("filterText").value = filters.q;
  document.getElementById("filterOwner").value = filters.owner;
  document.getElementById("filterSeverity").value = filters.severity;
  document.getElementById("filterStatus").value = filters.status;
  document.getElementById("filterIncludeResolved").checked = filters.resolved;
}

function initDialog() {
  const dialog = document.getElementById("issueDialog");
  const form = document.getElementById("issueForm");
  document.getElementById("issueOwner").innerHTML = agentsCache.map((a) => `<option value="${a.key}">${a.name}</option>`).join("");
  document.getElementById("reportIssueBtn").addEventListener("click", () => dialog.showModal());
  document.getElementById("issueDialogCancel").addEventListener("click", () => dialog.close());
  const escalation = document.getElementById("issueEscalation");
  const warning = document.getElementById("issueEscalationWarning");
  const updateEscalationWarning = () => { warning.hidden = !escalationPreview(); };
  escalation.addEventListener("change", updateEscalationWarning);
  ["issueTitle", "issueDescription", "issueMitigation"].forEach((id) => document.getElementById(id).addEventListener("input", updateEscalationWarning));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = { title: document.getElementById("issueTitle").value.trim(), description: document.getElementById("issueDescription").value.trim(), severity: document.getElementById("issueSeverity").value, owner: document.getElementById("issueOwner").value, mitigation: document.getElementById("issueMitigation").value.trim(), related_task: document.getElementById("issueRelatedTask").value.trim(), app_label: document.getElementById("issueAppLabel").value.trim() || null, escalation_flag: escalation.checked };
    if (!payload.title) return;
    try {
      const response = await fetch(`${API_BASE}/api/issues`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Create failed");
      issuesCache.unshift(result.issue || result);
      renderIssues(); setNotice(`${payload.title} logged as ${result.issue?.id || result.id}.`, "ok"); dialog.close(); form.reset(); warning.hidden = true;
    } catch (error) { setNotice(`Could not create issue: ${error.message}`, "warn"); }
  });
}

async function initIssuesPage() {
  try { agentsCache = await loadAgentCatalog(); issuesCache = await fetchIssues(); populateSelects(); initDialog(); ["filterText", "filterOwner", "filterSeverity", "filterStatus", "filterIncludeResolved"].forEach((id) => document.getElementById(id).addEventListener(id === "filterText" ? "input" : "change", renderIssues)); renderIssues(); } catch (error) { setNotice(error.message, "warn"); }
}

initIssuesPage();// Dynamic Issues tracker: localStorage-backed CRUD + the previously-unwired #issueDialog.
const ISSUES_STORAGE_KEY = "aisena-issues-v1";
const ISSUE_STATUS_CYCLE = ["Open", "Monitoring", "Mitigated", "Closed"];

const DEFAULT_ISSUES = [
  {
    id: "ISSUE-0001",
    title: "Copilot runtime model unavailable",
    severity: "High",
    owner: "Implementation Manager",
    status: "Open",
    mitigation: "Runtime diagnostics and fallback path",
  },
  {
    id: "ISSUE-0002",
    title: "No CI baseline configured",
    severity: "Medium",
    owner: "DevOps Engineer",
    status: "Open",
    mitigation: "Bootstrap minimal pipeline",
  },
  {
    id: "ISSUE-0003",
    title: "Task-to-goal traceability drift risk",
    severity: "Medium",
    owner: "Product Owner",
    status: "Monitoring",
    mitigation: "Periodic alignment checkpoints",
  },
];

function loadIssues() {
  const raw = localStorage.getItem(ISSUES_STORAGE_KEY);
  if (!raw) {
    saveIssues(DEFAULT_ISSUES);
    return DEFAULT_ISSUES.slice();
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_ISSUES.slice();
  } catch (err) {
    return DEFAULT_ISSUES.slice();
  }
}

function saveIssues(issues) {
  localStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(issues));
}

function nextIssueId(issues) {
  const numbers = issues
    .map((i) => parseInt(String(i.id).replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `ISSUE-${String(next).padStart(4, "0")}`;
}

function setIssuesNotice(message, tone) {
  const el = document.getElementById("issuesNotice");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("ok", "warn");
  el.classList.add(tone || "warn");
}

function renderIssues() {
  const body = document.getElementById("issuesBody");
  if (!body) return;
  const issues = loadIssues();

  if (!issues.length) {
    body.innerHTML = `<tr><td colspan="6">No open issues. Use "Report Issue" to log one.</td></tr>`;
    return;
  }

  body.innerHTML = issues
    .map(
      (issue) => `<tr data-issue-id="${issue.id}">
        <td>${issue.title}</td>
        <td>${issue.severity}</td>
        <td>${issue.owner}</td>
        <td><span class="pill">${issue.status}</span></td>
        <td>${issue.mitigation || "-"}</td>
        <td>
          <button type="button" class="ghost issue-cycle" data-issue-id="${issue.id}">Advance status</button>
          <button type="button" class="ghost issue-delete" data-issue-id="${issue.id}">Delete</button>
        </td>
      </tr>`
    )
    .join("");

  body.querySelectorAll(".issue-cycle").forEach((btn) => {
    btn.addEventListener("click", () => cycleIssueStatus(btn.dataset.issueId));
  });
  body.querySelectorAll(".issue-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteIssue(btn.dataset.issueId));
  });
}

function cycleIssueStatus(issueId) {
  const issues = loadIssues();
  const issue = issues.find((i) => i.id === issueId);
  if (!issue) return;
  const idx = ISSUE_STATUS_CYCLE.indexOf(issue.status);
  issue.status = ISSUE_STATUS_CYCLE[(idx + 1) % ISSUE_STATUS_CYCLE.length];
  saveIssues(issues);
  renderIssues();
  setIssuesNotice(`${issue.title} is now ${issue.status}.`, issue.status === "Closed" ? "ok" : "warn");
}

function deleteIssue(issueId) {
  const issues = loadIssues();
  const issue = issues.find((i) => i.id === issueId);
  if (!issue || !window.confirm(`Delete "${issue.title}"?`)) return;
  saveIssues(issues.filter((i) => i.id !== issueId));
  renderIssues();
  setIssuesNotice(`${issue.title} removed.`, "ok");
}

function initIssueDialog() {
  const dialog = document.getElementById("issueDialog");
  const form = document.getElementById("issueForm");
  const cancelBtn = document.getElementById("issueDialogCancel");
  const reportBtn = document.getElementById("reportIssueBtn");
  if (!dialog || !form) return;

  reportBtn?.addEventListener("click", () => dialog.showModal());
  cancelBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = document.getElementById("issueTitle").value.trim();
    const owner = document.getElementById("issueOwner").value.trim();
    if (!title || !owner) return;

    const issues = loadIssues();
    issues.unshift({
      id: nextIssueId(issues),
      title,
      severity: document.getElementById("issueSeverity").value,
      owner,
      status: "Open",
      mitigation: document.getElementById("issueMitigation").value.trim(),
    });
    saveIssues(issues);
    renderIssues();
    setIssuesNotice(`"${title}" logged as a new issue.`, "warn");
    dialog.close();
    form.reset();
  });
}

renderIssues();
initIssueDialog();
