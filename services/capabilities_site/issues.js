// Dynamic Issues tracker: localStorage-backed CRUD + the previously-unwired #issueDialog.
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
