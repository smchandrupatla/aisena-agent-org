// Dynamic Tasks board: localStorage-backed CRUD for the Tasks page.
const TASKS_STORAGE_KEY = "aisena-tasks-v1";
const STATUS_CYCLE = ["Planned", "In Progress", "Blocked", "Done"];

const DEFAULT_TASKS = [
  {
    id: "TASK-0010",
    name: "TASK-0010 Governance Activation",
    owner: "Implementation Manager",
    status: "In Progress",
    priority: "High",
    checkpoint: "Artifact review and signoff",
  },
  {
    id: "TASK-0011",
    name: "TASK-0011 Metrics and Critic Cadence",
    owner: "Release Manager",
    status: "Planned",
    priority: "High",
    checkpoint: "Define metric checklist",
  },
  {
    id: "TASK-0009",
    name: "TASK-0009 Stage 0 Backend Plan",
    owner: "Backend Engineer",
    status: "Planned",
    priority: "High",
    checkpoint: "Implementation scaffold review",
  },
];

function loadTasks() {
  const raw = localStorage.getItem(TASKS_STORAGE_KEY);
  if (!raw) {
    saveTasks(DEFAULT_TASKS);
    return DEFAULT_TASKS.slice();
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_TASKS.slice();
  } catch (err) {
    return DEFAULT_TASKS.slice();
  }
}

function saveTasks(tasks) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

function nextTaskId(tasks) {
  const numbers = tasks
    .map((t) => parseInt(String(t.id).replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (numbers.length ? Math.max(...numbers) : 9) + 1;
  return `TASK-${String(next).padStart(4, "0")}`;
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
  const tasks = loadTasks();

  if (!tasks.length) {
    body.innerHTML = `<tr><td colspan="6">No tasks yet. Use "Add task in backlog" to create one.</td></tr>`;
    return;
  }

  body.innerHTML = tasks
    .map(
      (task) => `<tr data-task-id="${task.id}">
        <td>${task.name}</td>
        <td>${task.owner}</td>
        <td><span class="pill">${task.status}</span></td>
        <td>${task.priority}</td>
        <td>${task.checkpoint || "-"}</td>
        <td>
          <button type="button" class="ghost task-cycle" data-task-id="${task.id}">Cycle status</button>
          <button type="button" class="ghost task-delete" data-task-id="${task.id}">Delete</button>
        </td>
      </tr>`
    )
    .join("");

  body.querySelectorAll(".task-cycle").forEach((btn) => {
    btn.addEventListener("click", () => cycleTaskStatus(btn.dataset.taskId));
  });
  body.querySelectorAll(".task-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteTask(btn.dataset.taskId));
  });
}

function cycleTaskStatus(taskId) {
  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  const idx = STATUS_CYCLE.indexOf(task.status);
  task.status = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  saveTasks(tasks);
  renderTasks();
  setTasksNotice(`${task.name} moved to ${task.status}.`, "ok");
}

function deleteTask(taskId) {
  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task || !window.confirm(`Delete ${task.name}?`)) return;
  saveTasks(tasks.filter((t) => t.id !== taskId));
  renderTasks();
  setTasksNotice(`${task.name} deleted.`, "warn");
}

function promptSelectTask(actionLabel) {
  const tasks = loadTasks();
  if (!tasks.length) {
    window.alert("No tasks available yet.");
    return null;
  }
  const listing = tasks.map((t, i) => `${i + 1}. ${t.name}`).join("\n");
  const choice = window.prompt(`${actionLabel}\n\n${listing}\n\nEnter the task number:`, "1");
  if (choice === null) return null;
  const idx = parseInt(choice, 10) - 1;
  return tasks[idx] || null;
}

function initTaskDialog() {
  const dialog = document.getElementById("taskDialog");
  const form = document.getElementById("taskForm");
  const title = document.getElementById("taskDialogTitle");
  const cancelBtn = document.getElementById("taskDialogCancel");
  if (!dialog || !form) return;

  cancelBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("taskName").value.trim();
    const owner = document.getElementById("taskOwner").value.trim();
    if (!name || !owner) return;

    const tasks = loadTasks();
    tasks.unshift({
      id: nextTaskId(tasks),
      name,
      owner,
      status: document.getElementById("taskStatus").value,
      priority: document.getElementById("taskPriority").value,
      checkpoint: document.getElementById("taskCheckpoint").value.trim(),
    });
    saveTasks(tasks);
    renderTasks();
    setTasksNotice(`${name} added to the backlog.`, "ok");
    dialog.close();
    form.reset();
  });

  document.getElementById("quickAddTask")?.addEventListener("click", () => {
    title.textContent = "Add Task";
    dialog.showModal();
  });
}

function initQuickActions() {
  document.getElementById("quickAssignOwner")?.addEventListener("click", () => {
    const task = promptSelectTask("Assign owner to which task?");
    if (!task) return;
    const owner = window.prompt("New owner:", task.owner);
    if (!owner) return;
    const tasks = loadTasks();
    const target = tasks.find((t) => t.id === task.id);
    target.owner = owner.trim();
    saveTasks(tasks);
    renderTasks();
    setTasksNotice(`${task.name} reassigned to ${target.owner}.`, "ok");
  });

  document.getElementById("quickSetDependency")?.addEventListener("click", () => {
    const task = promptSelectTask("Set a dependency on which task?");
    if (!task) return;
    const dependency = window.prompt("Dependency note:", "");
    if (!dependency) return;
    const tasks = loadTasks();
    const target = tasks.find((t) => t.id === task.id);
    target.checkpoint = `Depends on: ${dependency.trim()}`;
    saveTasks(tasks);
    renderTasks();
    setTasksNotice(`Dependency recorded for ${task.name}.`, "ok");
  });

  document.getElementById("quickLogHandoff")?.addEventListener("click", () => {
    const task = promptSelectTask("Log a handoff for which task?");
    if (!task) return;
    const note = window.prompt("Handoff note:", "");
    if (!note) return;
    const tasks = loadTasks();
    const target = tasks.find((t) => t.id === task.id);
    target.checkpoint = `Handoff: ${note.trim()}`;
    saveTasks(tasks);
    renderTasks();
    setTasksNotice(`Handoff logged for ${task.name}.`, "ok");
  });
}

renderTasks();
initTaskDialog();
initQuickActions();
