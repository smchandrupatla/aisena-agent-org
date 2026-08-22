// Task workflow: fetches tasks and the live agent directory from the API, renders a
// filterable list (state synced to the URL query string), and wires the add-task
// dialog + quick actions. Single source of truth: /api/tasks and /api/agents.
const TASK_STATUSES = ["Backlog", "Planned", "In Progress", "Blocked", "In Review", "Done"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];

let tasksCache = [];
let agentsCache = [];

async function fetchTasks() {
  try {
    const response = await fetch(`${API_BASE}/api/tasks`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch (err) {
    return [];
  }
}

function ownerLabel(ownerKey) {
  if (!ownerKey) return "Unassigned";
  const agent = agentsCache.find((a) => a.key === ownerKey);
  return agent ? agent.name : ownerKey;
}

function getFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") || "",
    owner: params.get("owner") || "",
    status: params.get("status") || "",
    priority: params.get("priority") || "",
    app_label: params.get("app_label") || "",
  };
}

function setFiltersInUrl(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.app_label) params.set("app_label", filters.app_label);
  const query = params.toString();
  const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", newUrl);
}

function readFiltersFromForm() {
  return {
    q: document.getElementById("filterText").value.trim(),
    owner: document.getElementById("filterOwner").value,
    status: document.getElementById("filterStatus").value,
    priority: document.getElementById("filterPriority").value,
    app_label: document.getElementById("filterAppLabel").value,
  };
}

function applyFilters(tasks, filters) {
  const q = filters.q.toLowerCase();
  return tasks.filter((task) => {
    if (q) {
      const haystack = `${task.title || ""} ${task.description || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.owner && task.owner !== filters.owner) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.app_label && (task.app_label || "") !== filters.app_label) return false;
    return true;
  });
}

function setTasksNotice(message, tone) {
  const el = document.getElementById("tasksNotice");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("ok", "warn");
  el.classList.add(tone || "ok");
}

function renderTasks() {
  const body = document.getElementById("tasksBody");
  if (!body) return;
  const filters = readFiltersFromForm();
  setFiltersInUrl(filters);
  const filtered = applyFilters(tasksCache, filters);

  if (!filtered.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="7">No tasks match this view. Use "Add task in backlog" to create one.</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map(
      (task) => `<tr data-task-id="${task.id}">
        <td><a class="task-link" href="task.html?id=${encodeURIComponent(task.id)}">${task.id} ${task.title}</a></td>
        <td>${task.app_label || "-"}</td>
        <td>${ownerLabel(task.owner)}</td>
        <td><span class="pill">${task.status}</span></td>
        <td>${task.priority}</td>
        <td>${task.next_checkpoint || "-"}</td>
        <td>
          <a class="ghost" href="task.html?id=${encodeURIComponent(task.id)}" style="text-decoration:none; display:inline-block; padding:9px 15px; border-radius:11px;">Open</a>
          <button type="button" class="ghost task-delete" data-task-id="${task.id}">Delete</button>
        </td>
      </tr>`
    )
    .join("");

  body.querySelectorAll(".task-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteTask(btn.dataset.taskId));
  });
}

async function deleteTask(taskId) {
  const task = tasksCache.find((t) => t.id === taskId);
  if (!task || !window.confirm(`Delete ${task.id} ${task.title}?`)) return;
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Delete failed");
    tasksCache = tasksCache.filter((t) => t.id !== taskId);
    renderTasks();
    setTasksNotice(`${task.id} deleted.`, "warn");
  } catch (err) {
    setTasksNotice(`Could not delete ${task.id}: ${err.message}`, "warn");
  }
}

function populateFilterSelects() {
  const ownerSelect = document.getElementById("filterOwner");
  const statusSelect = document.getElementById("filterStatus");
  const prioritySelect = document.getElementById("filterPriority");
  const appLabelSelect = document.getElementById("filterAppLabel");

  const ownerOptions = agentsCache
    .map((agent) => `<option value="${agent.key}">${agent.name}</option>`)
    .join("");
  ownerSelect.innerHTML = `<option value="">All Owners</option>${ownerOptions}`;
  statusSelect.innerHTML = `<option value="">All Statuses</option>${TASK_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("")}`;
  prioritySelect.innerHTML = `<option value="">All Priorities</option>${TASK_PRIORITIES.map((p) => `<option value="${p}">${p}</option>`).join("")}`;

  // Populate app label filter from distinct labels in tasks
  const labels = [...new Set(tasksCache.map((t) => t.app_label).filter(Boolean))].sort();
  appLabelSelect.innerHTML = `<option value="">All App Labels</option>${labels.map((l) => `<option value="${l}">${l}</option>`).join("")}`;

  const filters = getFiltersFromUrl();
  document.getElementById("filterText").value = filters.q;
  ownerSelect.value = filters.owner;
  statusSelect.value = filters.status;
  prioritySelect.value = filters.priority;
  appLabelSelect.value = filters.app_label;
}

function initFilterBar() {
  ["filterText", "filterOwner", "filterStatus", "filterPriority", "filterAppLabel"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderTasks);
    document.getElementById(id).addEventListener("change", renderTasks);
  });
  document.getElementById("filterClear").addEventListener("click", () => {
    document.getElementById("filterText").value = "";
    document.getElementById("filterOwner").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterPriority").value = "";
    document.getElementById("filterAppLabel").value = "";
    renderTasks();
  });
}

function populateTaskDialogSelects() {
  const ownerSelect = document.getElementById("taskOwner");
  const statusSelect = document.getElementById("taskStatus");
  const prioritySelect = document.getElementById("taskPriority");
  const dependencySelect = document.getElementById("taskDependency");

  ownerSelect.innerHTML = agentsCache.map((agent) => `<option value="${agent.key}">${agent.name}</option>`).join("");
  statusSelect.innerHTML = TASK_STATUSES.map((s) => `<option value="${s}" ${s === "Backlog" ? "selected" : ""}>${s}</option>`).join("");
  prioritySelect.innerHTML = TASK_PRIORITIES.map((p) => `<option value="${p}" ${p === "Medium" ? "selected" : ""}>${p}</option>`).join("");
  dependencySelect.innerHTML =
    `<option value="">None</option>` +
    tasksCache.map((t) => `<option value="${t.id}">${t.id} ${t.title}</option>`).join("");
}

function initTaskDialog() {
  const dialog = document.getElementById("taskDialog");
  const form = document.getElementById("taskForm");
  const cancelBtn = document.getElementById("taskDialogCancel");
  if (!dialog || !form) return;

  cancelBtn.addEventListener("click", () => dialog.close());

  document.getElementById("quickAddTask")?.addEventListener("click", () => {
    form.reset();
    populateTaskDialogSelects();
    dialog.showModal();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.getElementById("taskTitle").value.trim();
    if (!title) return;

    const tags = document
      .getElementById("taskTags")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title,
      description: document.getElementById("taskDescription").value.trim(),
      owner: document.getElementById("taskOwner").value,
      status: document.getElementById("taskStatus").value,
      priority: document.getElementById("taskPriority").value,
      dependency: document.getElementById("taskDependency").value || null,
      next_checkpoint: document.getElementById("taskCheckpoint").value.trim(),
      tags,
      app_label: document.getElementById("taskAppLabel").value.trim() || null,
    };

    try {
      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Create failed");
      tasksCache.unshift(result.task);
      renderTasks();
      setTasksNotice(`${result.task.id} added to the backlog.`, "ok");
      dialog.close();
      form.reset();
    } catch (err) {
      setTasksNotice(`Could not create task: ${err.message}`, "warn");
    }
  });
}

function initQuickPickActions() {
  const dialog = document.getElementById("quickPickDialog");
  const form = document.getElementById("quickPickForm");
  const titleEl = document.getElementById("quickPickTitle");
  const labelEl = document.getElementById("quickPickLabel");
  const select = document.getElementById("quickPickTask");
  const cancelBtn = document.getElementById("quickPickCancel");
  if (!dialog || !form) return;

  let focusField = null;

  cancelBtn.addEventListener("click", () => dialog.close());

  function openQuickPick(title, labelText, field) {
    if (!tasksCache.length) {
      window.alert("No tasks available yet. Add a task first.");
      return;
    }
    focusField = field;
    titleEl.textContent = title;
    labelEl.firstChild.textContent = `${labelText} `;
    select.innerHTML = tasksCache.map((t) => `<option value="${t.id}">${t.id} ${t.title}</option>`).join("");
    dialog.showModal();
  }

  document.getElementById("quickAssignOwner")?.addEventListener("click", () => {
    openQuickPick("Assign owner", "Task to reassign", "owner");
  });
  document.getElementById("quickSetDependency")?.addEventListener("click", () => {
    openQuickPick("Set dependency", "Task to update", "dependency");
  });
  document.getElementById("quickLogHandoff")?.addEventListener("click", () => {
    openQuickPick("Log handoff", "Task to update", "next_checkpoint");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const taskId = select.value;
    if (!taskId) return;
    window.location.href = `task.html?id=${encodeURIComponent(taskId)}&focus=${encodeURIComponent(focusField)}`;
  });
}

async function initTasksPage() {
  agentsCache = await loadAgentCatalog();
  tasksCache = await fetchTasks();
  populateFilterSelects();
  initFilterBar();
  initTaskDialog();
  initQuickPickActions();
  renderTasks();
}

initTasksPage();
