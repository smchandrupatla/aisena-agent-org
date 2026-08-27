// Task workflow: fetches tasks and the live agent directory from the API, renders a
// filterable list (state synced to the URL query string), and wires the add-task
// dialog + quick actions. Single source of truth: /api/tasks and /api/agents.
const TASK_STATUSES = ["To Do", "Backlog", "Planned", "In Progress", "Blocked", "In Review", "Done"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent", "Critical"];

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
    body.innerHTML = `<tr class="empty-row"><td colspan="9">No tasks match this view. Use "Add task in backlog" to create one.</td></tr>`;
    return;
  }

  // Update selectAll state
  const selectAll = document.getElementById("selectAll");
  const allChecked = filtered.length > 0 && filtered.every((t) => true); // Will be updated per row
  selectAll.indeterminate = filtered.some((t) => /* check checked state */ false);
  selectAll.checked = filtered.length > 0 && filtered.every((t) => /* check if checkbox exists and checked */ true);

  body.innerHTML = filtered
    .map(
      (task) => `<tr data-task-id="${task.id}">
        <td><input type="checkbox" class="task-checkbox" data-task-id="${task.id}"></td>
        <td><a class="task-link" href="task.html?id=${encodeURIComponent(task.id)}">${task.id} ${task.title}</a></td>
        <td>${task.app_label || "-"}</td>
        <td>${ownerLabel(task.owner)}</td>
        <td><span class="pill">${task.status}</span></td>
        <td>${task.priority}</td>
        <td>${task.next_checkpoint || "-"}</td>
        <td>
          <a class="ghost" href="task.html?id=${encodeURIComponent(task.id)}" style="text-decoration:none; display:inline-block; padding:9px 15px; border-radius:11px;">Open</a>
          <button type="button" class="ghost task-run" data-task-id="${task.id}">Run</button>
          <button type="button" class="ghost task-delete" data-task-id="${task.id}">Delete</button>
        </td>
      </tr>`
    )
    .join("");

  // Add checkbox change listeners after rendering
  initTaskCheckboxes();
  initTaskRunButtons();
}
        <td><span class="pill">${task.status}</span></td>
        <td>${task.priority}</td>
        <td>${task.next_checkpoint || "-"}</td>
        <td>
          <a class="ghost" href="task.html?id=${encodeURIComponent(task.id)}" style="text-decoration:none; display:inline-block; padding:9px 15px; border-radius:11px;">Open</a>
          <button type="button" class="ghost task-run" data-task-id="${task.id}">Run</button>
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

function initBulkActions() {
  const selectAllCheckbox = document.getElementById("selectAll");
  const bulkActions = document.getElementById("bulkActions");
  const bulkRunBtn = document.getElementById("bulkRunBtn");
  const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
  const taskCheckboxes = document.querySelectorAll(".task-checkbox");

  if (!selectAllCheckbox || !bulkActions) return;

  selectAllCheckbox.addEventListener("change", () => {
    taskCheckboxes.forEach((checkbox) => {
      checkbox.checked = selectAllCheckbox.checked;
    });
    updateBulkActionsVisibility();
  });

  taskCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const allChecked = Array.from(taskCheckboxes).every((cb) => cb.checked);
      const someChecked = Array.from(taskCheckboxes).some((cb) => cb.checked);
      selectAllCheckbox.checked = allChecked;
      selectAllCheckbox.indeterminate = someChecked && !allChecked;
      updateBulkActionsVisibility();
    });
  });

  bulkRunBtn?.addEventListener("click", () => showBulkRunDialog());
  bulkDeleteBtn?.addEventListener("click", () => bulkDeleteTasks());
}

function updateBulkActionsVisibility() {
  const selectedCount = document.querySelectorAll(".task-checkbox:checked").length;
  const bulkActions = document.getElementById("bulkActions");
  if (bulkActions) {
    bulkActions.style.display = selectedCount > 0 ? "flex" : "none";
  }
}

function showBulkRunDialog() {
  const selectedTasks = Array.from(document.querySelectorAll(".task-checkbox:checked"))
    .map((cb) => cb.closest("tr").dataset.taskId);

  const dialog = document.getElementById("bulkRunDialog");
  const modelSelect = document.getElementById("bulkModelSelect");
  const confirmBtn = document.getElementById("bulkRunConfirm");

  if (!dialog || !modelSelect) return;

  dialog.showModal();

  modelSelect.innerHTML = `
    <option value="">Select Model...</option>
    <optgroup label="Free Models">
      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
      <option value="claude-3-haiku">Claude 3 Haiku</option>
      <option value="llama-2-7b">Llama 2 7B</option>
    </optgroup>
    <optgroup label="Paid Models">
      <option value="gpt-4">GPT-4</option>
      <option value="claude-3-opus">Claude 3 Opus</option>
      <option value="gpt-4-turbo">GPT-4 Turbo</option>
      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
    </optgroup>
  `;

  confirmBtn.disabled = true;

  modelSelect.addEventListener("change", () => {
    confirmBtn.disabled = !modelSelect.value;
  });

  document.getElementById("bulkRunCancel")?.addEventListener("click", () => dialog.close());

  confirmBtn.addEventListener("click", async () => {
    const model = modelSelect.value;
    dialog.close();
    await bulkRunTasks(selectedTasks, model);
  });
}

async function bulkRunTasks(taskIds, model) {
  const notice = document.getElementById("tasksNotice");
  try {
    notice.textContent = `Running ${taskIds.length} task(s) with ${model}...`;
    notice.className = "notice ok";

    const response = await fetch(`${API_BASE}/api/tasks/bulk-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds, model }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Bulk run failed");

    notice.textContent = result.message || `${taskIds.length} task(s) started with ${model}`;
    tasksCache = tasksCache.filter((t) => !taskIds.includes(t.id));
    renderTasks();
  } catch (err) {
    notice.textContent = `Bulk run failed: ${err.message}`;
    notice.className = "notice warn";
  }
}

async function bulkDeleteTasks() {
  const selectedTasks = Array.from(document.querySelectorAll(".task-checkbox:checked"))
    .map((cb) => cb.closest("tr").dataset.taskId);

  if (!selectedTasks.length) return;

  if (!window.confirm(`Delete ${selectedTasks.length} task(s)?`)) return;

  const notice = document.getElementById("tasksNotice");
  try {
    notice.textContent = `Deleting ${selectedTasks.length} task(s)...`;
    notice.className = "notice warn";

    for (const taskId of selectedTasks) {
      const response = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`Failed to delete task ${taskId}`);
    }

    tasksCache = tasksCache.filter((t) => !selectedTasks.includes(t.id));
    notice.textContent = `${selectedTasks.length} task(s) deleted.`;
    renderTasks();
  } catch (err) {
    notice.textContent = `Bulk delete failed: ${err.message}`;
    notice.className = "notice warn";
  }
}

function initTaskRun() {
  document.querySelectorAll(".task-run").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const taskId = e.currentTarget.dataset.taskId;
      showTaskRunDialog(taskId);
    });
  });
}

function showTaskRunDialog(taskId) {
  const dialog = document.getElementById("taskRunDialog");
  const modelSelect = document.getElementById("taskModelSelect");
  const confirmBtn = document.getElementById("taskRunConfirm");

  if (!dialog || !modelSelect) return;

  dialog.showModal();

  modelSelect.innerHTML = `
    <option value="">Select Model...</option>
    <optgroup label="Free Models">
      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
      <option value="claude-3-haiku">Claude 3 Haiku</option>
      <option value="llama-2-7b">Llama 2 7B</option>
    </optgroup>
    <optgroup label="Paid Models">
      <option value="gpt-4">GPT-4</option>
      <option value="claude-3-opus">Claude 3 Opus</option>
      <option value="gpt-4-turbo">GPT-4 Turbo</option>
      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
    </optgroup>
  `;

  confirmBtn.disabled = true;

  modelSelect.addEventListener("change", () => {
    confirmBtn.disabled = !modelSelect.value;
  });

  document.getElementById("taskRunCancel")?.addEventListener("click", () => dialog.close());

  confirmBtn.addEventListener("click", async () => {
    const model = modelSelect.value;
    dialog.close();
    await runSingleTask(taskId, model);
  });
}

async function runSingleTask(taskId, model) {
  const notice = document.getElementById("tasksNotice");
  try {
    notice.textContent = `Running task ${taskId} with ${model}...`;
    notice.className = "notice ok";

    const response = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(taskId)}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Task run failed");

    notice.textContent = result.message || `Task ${taskId} started with ${model}`;
  }

  // Initialize task checkboxes after rendering
  initTaskCheckboxes();

  // Initialize task run buttons
  initTaskRunButtons();
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

function initTaskUploadDialog() {
  const dialog = document.getElementById("taskUploadDialog");
  const form = document.getElementById("taskUploadForm");
  const fileInput = document.getElementById("taskUploadFile");
  const uploaderInput = document.getElementById("taskUploadUser");
  const notice = document.getElementById("taskUploadNotice");
  const previewPanel = document.getElementById("taskUploadPreviewPanel");
  const previewBody = document.getElementById("taskUploadPreviewBody");
  const summary = document.getElementById("taskUploadSummary");
  const confirmButton = document.getElementById("taskUploadConfirm");
  const results = document.getElementById("taskUploadResults");
  if (!dialog || !form) return;

  let previewRows = [];
  let uploadFilename = "";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const resetDialog = () => {
    form.reset();
    uploaderInput.value = "Portal User";
    previewRows = [];
    uploadFilename = "";
    previewPanel.hidden = true;
    results.hidden = true;
    results.replaceChildren();
    notice.textContent = "Choose a CSV or XLSX file to validate before importing.";
    notice.className = "notice";
  };

  const closeDialog = () => {
    dialog.close();
    resetDialog();
  };

  const agentIsEligible = (agent) => {
    return agent.active !== false
      && agent.available !== false
      && ["ready", "available"].includes(agent.status || "ready");
  };

  const ownerOptions = (row) => {
    const options = agentsCache.map((agent) => {
      const selected = agent.key === row.owner ? " selected" : "";
      const eligible = agentIsEligible(agent);
      const suffix = eligible ? "" : " (not eligible)";
      return `<option value="${escapeHtml(agent.key)}"${selected}>${escapeHtml(agent.name)}${suffix}</option>`;
    }).join("");
    return `<option value=""${row.owner ? "" : " selected"}>Unassigned</option>${options}`;
  };

  const renderPreview = () => {
    const counts = {
      total: previewRows.length,
      valid: previewRows.filter((row) => !row.errors.length && !row.duplicate).length,
      rejected: previewRows.filter((row) => row.errors.length).length,
      duplicates: previewRows.filter((row) => row.duplicate).length,
      assignmentRequired: previewRows.filter((row) => row.assignment_required).length,
    };
    summary.innerHTML = [
      `<span>${counts.total} rows</span>`,
      `<span>${counts.valid} ready</span>`,
      `<span>${counts.duplicates} duplicate warnings</span>`,
      `<span>${counts.rejected} rejected</span>`,
      `<span>${counts.assignmentRequired} assignment required</span>`,
    ].join("");
    confirmButton.disabled = counts.valid === 0;

    previewBody.innerHTML = previewRows.map((row, index) => {
      const messages = [
        ...row.errors.map((message) => `<span class="upload-row-message">${escapeHtml(message)}</span>`),
        ...row.warnings.map((message) => `<span class="upload-row-message warning">${escapeHtml(message)}</span>`),
      ].join("");
      const rowClass = row.errors.length ? "row-error" : row.warnings.length ? "row-warning" : "";
      return `<tr class="${rowClass}">
        <td>${row.row_number}</td>
        <td><strong>${escapeHtml(row.title || "Untitled")}</strong><br>${escapeHtml(row.description || "No description")}</td>
        <td>${escapeHtml(row.priority)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.dependency || "None")}<br>${escapeHtml(row.next_checkpoint || "No checkpoint")}</td>
        <td>${escapeHtml(row.app_label || "No app label")}<br>${escapeHtml((row.tags || []).join("; ") || "No tags")}</td>
        <td><select class="upload-owner" data-row-index="${index}">${ownerOptions(row)}</select></td>
        <td>${messages || "Ready"}</td>
      </tr>`;
    }).join("");

    previewBody.querySelectorAll(".upload-owner").forEach((select) => {
      select.addEventListener("change", () => {
        const row = previewRows[Number(select.dataset.rowIndex)];
        row.owner = select.value;
        row.assignment_method = "manual";
        row.errors = row.errors.filter((message) => !message.startsWith("Owner"));
        row.warnings = row.warnings.filter((message) => !message.startsWith("Assignment Required"));
        const agent = agentsCache.find((candidate) => candidate.key === select.value);
        if (!agent) {
          row.assignment_required = true;
          row.warnings.push("Assignment Required: no agent is selected.");
        } else if (!agentIsEligible(agent)) {
          row.assignment_required = false;
          row.errors.push("Owner must be active and available.");
        } else {
          row.assignment_required = false;
        }
        renderPreview();
      });
    });
  };

  document.getElementById("uploadTasksButton")?.addEventListener("click", () => {
    resetDialog();
    dialog.showModal();
  });
  document.getElementById("taskUploadCancel")?.addEventListener("click", closeDialog);
  document.getElementById("taskUploadCancelPreview")?.addEventListener("click", closeDialog);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = fileInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    notice.textContent = "Validating New Task fields and calculating assignments...";
    notice.className = "notice";
    try {
      const response = await fetch(`${API_BASE}/api/tasks/upload/preview`, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Preview failed");
      previewRows = payload.rows;
      uploadFilename = payload.filename;
      renderPreview();
      previewPanel.hidden = false;
      results.hidden = true;
      notice.textContent = "Review validation messages and assignments before confirming the import.";
      notice.className = payload.valid ? "notice ok" : "notice warn";
    } catch (error) {
      previewPanel.hidden = true;
      notice.textContent = `Could not preview tasks: ${error.message}`;
      notice.className = "notice warn";
    }
  });

  confirmButton.addEventListener("click", async () => {
    confirmButton.disabled = true;
    notice.textContent = "Importing validated tasks...";
    try {
      const response = await fetch(`${API_BASE}/api/tasks/upload/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewRows, filename: uploadFilename, uploader: uploaderInput.value.trim() || "Portal User" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Import failed");
      const createdItems = payload.created.map((item) => `<li><strong>${escapeHtml(item.task_id)}</strong> ${escapeHtml(item.title)} — ${escapeHtml(ownerLabel(item.assigned_agent))} (${escapeHtml(item.assignment_method)})</li>`).join("");
      const rejectedItems = payload.rejected.map((item) => `<li>Row ${item.row_number}: ${escapeHtml(item.title)} — ${escapeHtml(item.errors.join(" "))}</li>`).join("");
      const skippedItems = payload.skipped.map((item) => `<li>Row ${item.row_number}: ${escapeHtml(item.title)} — ${escapeHtml(item.reason)}</li>`).join("");
      results.innerHTML = `<h4>Import Results</h4>
        <div class="upload-summary"><span>${payload.totals.created} created</span><span>${payload.totals.skipped} skipped</span><span>${payload.totals.rejected} rejected</span></div>
        ${createdItems ? `<h5>Created tasks</h5><ul class="upload-results-list">${createdItems}</ul>` : ""}
        ${skippedItems ? `<h5>Skipped tasks</h5><ul class="upload-results-list">${skippedItems}</ul>` : ""}
        ${rejectedItems ? `<h5>Rejected tasks</h5><ul class="upload-results-list">${rejectedItems}</ul>` : ""}`;
      results.hidden = false;
      previewPanel.hidden = true;
      notice.textContent = "Import complete. Results and generated task IDs are shown below.";
      notice.className = "notice ok";
      tasksCache = await fetchTasks();
      populateFilterSelects();
      renderTasks();
    } catch (error) {
      confirmButton.disabled = false;
      notice.textContent = `Could not import tasks: ${error.message}`;
      notice.className = "notice warn";
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
  initTaskUploadDialog();
  initQuickPickActions();
  initFilterBar();
  initBulkActions();
  initTaskCheckboxes();
  initTaskRunButtons();
  renderTasks();
}

initTasksPage();
