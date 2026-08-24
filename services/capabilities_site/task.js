// Task detail page: editable standard fields, activity log, comment thread, and a
// per-task AI chat that reuses the shared /api/agents/:agentId/message backend.
const TASK_STATUSES = ["Backlog", "Planned", "In Progress", "Blocked", "In Review", "Done"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];

const params = new URLSearchParams(window.location.search);
const taskId = params.get("id");
const focusField = params.get("focus");

let agentsCache = [];
let allTasksCache = [];
let currentTask = null;

function ownerLabel(ownerKey) {
  if (!ownerKey) return "Unassigned";
  const agent = agentsCache.find((a) => a.key === ownerKey);
  return agent ? agent.name : ownerKey;
}

function formatTimestamp(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

async function fetchTask(id) {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    return data.task || null;
  } catch (err) {
    return null;
  }
}

async function fetchAllTasks() {
  try {
    const response = await fetch(`${API_BASE}/api/tasks`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch (err) {
    return [];
  }
}

function renderHeader(task) {
  document.getElementById("taskHeading").textContent = `${task.id}: ${task.title}`;
  document.getElementById("taskSubtitle").textContent =
    `${task.status} Ã¢â‚¬Â¢ ${task.priority} priority Ã¢â‚¬Â¢ Owner: ${ownerLabel(task.owner)}` +
    (task.app_label ? ` Ã¢â‚¬Â¢ App: ${task.app_label}` : '');
  document.getElementById("taskCreatedAt").textContent = formatTimestamp(task.created_at);
  document.getElementById("taskUpdatedAt").textContent = formatTimestamp(task.updated_at);
}

function renderFields(task) {
  document.getElementById("fieldTitle").value = task.title || "";
  document.getElementById("fieldDescription").value = task.description || "";

  const ownerSelect = document.getElementById("fieldOwner");
  ownerSelect.innerHTML = agentsCache.map((agent) => `<option value="${agent.key}">${agent.name}</option>`).join("");
  ownerSelect.value = task.owner || "";

  const statusSelect = document.getElementById("fieldStatus");
  statusSelect.innerHTML = TASK_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("");
  statusSelect.value = task.status;

  const prioritySelect = document.getElementById("fieldPriority");
  prioritySelect.innerHTML = TASK_PRIORITIES.map((p) => `<option value="${p}">${p}</option>`).join("");
  prioritySelect.value = task.priority;

  const dependencySelect = document.getElementById("fieldDependency");
  const otherTasks = allTasksCache.filter((t) => t.id !== task.id);
  dependencySelect.innerHTML =
    `<option value="">None</option>` +
    otherTasks.map((t) => `<option value="${t.id}">${t.id} ${t.title}</option>`).join("");
  dependencySelect.value = task.dependency || "";

  document.getElementById("fieldCheckpoint").value = task.next_checkpoint || "";
  document.getElementById("fieldTags").value = (task.tags || []).join(", ");
  document.getElementById("fieldAppLabel").value = task.app_label || "";
}

function renderActivityLog(task) {
  const root = document.getElementById("activityLog");
  const entries = (task.activity_log || []).slice().reverse();
  if (!entries.length) {
    root.innerHTML = `<p style="color: var(--ink-soft); font-size: 13px;">No activity yet.</p>`;
    return;
  }
  root.innerHTML = entries
    .map(
      (entry) => `<div class="activity-entry">
        <time>${formatTimestamp(entry.timestamp)} Ã¢â‚¬Â¢ ${entry.actor || "system"}</time>
        ${entry.details || entry.action}
      </div>`
    )
    .join("");
}

function renderComments(task) {
  const root = document.getElementById("commentThread");
  const comments = task.comments || [];
  if (!comments.length) {
    root.innerHTML = `<p style="color: var(--ink-soft); font-size: 13px;">No comments yet. Be the first to add one.</p>`;
    return;
  }
  root.innerHTML = comments
    .map(
      (c) => `<div class="comment-entry">
        <div class="comment-meta"><span>${c.author || "User"}</span><span>${formatTimestamp(c.timestamp)}</span></div>
        <p>${escapeHtml(c.text)}</p>
      </div>`
    )
    .join("");
  root.scrollTop = root.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

async function reloadTask() {
  currentTask = await fetchTask(taskId);
  if (!currentTask) return;
  renderHeader(currentTask);
  renderFields(currentTask);
  renderActivityLog(currentTask);
  renderComments(currentTask);
}

function initFieldsForm() {
  const saveBtn = document.getElementById("saveTaskFields");
  const statusEl = document.getElementById("taskSaveStatus");

  saveBtn.addEventListener("click", async () => {
    const tags = document
      .getElementById("fieldTags")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: document.getElementById("fieldTitle").value.trim(),
      description: document.getElementById("fieldDescription").value.trim(),
      owner: document.getElementById("fieldOwner").value,
      status: document.getElementById("fieldStatus").value,
      priority: document.getElementById("fieldPriority").value,
      dependency: document.getElementById("fieldDependency").value || null,
      next_checkpoint: document.getElementById("fieldCheckpoint").value.trim(),
      tags,
      app_label: document.getElementById("fieldAppLabel").value.trim() || null,
      actor: "user",
    };

    statusEl.textContent = "Saving...";
    statusEl.classList.remove("ok");
    try {
      const response = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Save failed");
      currentTask = result.task;
      renderHeader(currentTask);
      renderActivityLog(currentTask);
      const ownerSelect = document.getElementById("chatAgentSelect");
      if (ownerSelect) populateChatAgentSelect();
      statusEl.textContent = "Saved.";
      statusEl.classList.add("ok");
    } catch (err) {
      statusEl.textContent = `Save failed: ${err.message}`;
    }
  });
}

function initCommentForm() {
  const form = document.getElementById("commentForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const textarea = document.getElementById("commentText");
    const text = textarea.value.trim();
    if (!text) return;
    await postComment("User", text);
    textarea.value = "";
  });
}

async function postComment(author, text) {
  try {
    const response = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(taskId)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, text }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Comment failed");
    currentTask = result.task;
    renderComments(currentTask);
    renderActivityLog(currentTask);
    renderHeader(currentTask);
    return true;
  } catch (err) {
    window.alert(`Could not post comment: ${err.message}`);
    return false;
  }
}

function buildTaskContext(task) {
  const comments = (task.comments || [])
    .map((c) => `- [${formatTimestamp(c.timestamp)}] ${c.author}: ${c.text}`)
    .join("\n") || "None";
  const activity = (task.activity_log || [])
    .map((a) => `- [${formatTimestamp(a.timestamp)}] ${a.actor}: ${a.details || a.action}`)
    .join("\n") || "None";

  return `Task ${task.id}: ${task.title}
Status: ${task.status} | Priority: ${task.priority} | Owner: ${ownerLabel(task.owner)}
Dependency: ${task.dependency || "None"} | Next checkpoint: ${task.next_checkpoint || "None"}
Tags: ${(task.tags || []).join(", ") || "None"}
Description: ${task.description || "None"}

Comment thread:
${comments}

Activity log:
${activity}`;
}

function populateChatAgentSelect() {
  const select = document.getElementById("chatAgentSelect");
  select.innerHTML = agentsCache.map((agent) => `<option value="${agent.key}">${agent.name}</option>`).join("");
  select.value = currentTask.owner && agentsCache.some((a) => a.key === currentTask.owner)
    ? currentTask.owner
    : agentsCache[0]?.key || "";
}

function renderChatMessage(message) {
  const root = document.getElementById("chatMessages");
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${message.role}`;
  wrapper.textContent = message.text;
  root.appendChild(wrapper);

  if (message.role === "assistant") {
    const postRow = document.createElement("div");
    postRow.className = "chat-pending-post";
    const postBtn = document.createElement("button");
    postBtn.type = "button";
    postBtn.className = "ghost";
    postBtn.textContent = "Post to comment thread";
    postBtn.addEventListener("click", async () => {
      const agentName = agentsCache.find((a) => a.key === document.getElementById("chatAgentSelect").value)?.name || "Agent";
      postBtn.disabled = true;
      const posted = await postComment(`${agentName} (AI)`, message.text);
      if (posted) {
        postBtn.textContent = "Posted";
      } else {
        postBtn.disabled = false;
      }
    });
    postRow.appendChild(postBtn);
    root.appendChild(postRow);
  }
  root.scrollTop = root.scrollHeight;
}

function initChat() {
  populateChatAgentSelect();
  const messagesRoot = document.getElementById("chatMessages");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendChat");
  const clearBtn = document.getElementById("clearChat");

  messagesRoot.innerHTML = "";
  const intro = { role: "system", text: `Ask about ${currentTask.id}. Responses are grounded in this task's current state, comments, and activity log.` };
  renderChatMessage(intro);

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    const agentKey = document.getElementById("chatAgentSelect").value;
    const agent = agentsCache.find((a) => a.key === agentKey);
    if (!agent) return;

    renderChatMessage({ role: "user", text });
    input.value = "";
    sendBtn.disabled = true;

    const prompt = `${buildTaskContext(currentTask)}\n\nQuestion: ${text}\n\nAnswer concisely, grounded only in the task data above.`;
    try {
      const response = await fetch(`${API_BASE}/api/agents/${agent.key}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, tool_actions: [] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Agent request failed");
      renderChatMessage({ role: "assistant", text: result.reply });
    } catch (err) {
      renderChatMessage({ role: "assistant", text: `${agent.name}: I could not reach the live runtime. ${err.message}` });
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  clearBtn.addEventListener("click", () => {
    messagesRoot.innerHTML = "";
    renderChatMessage(intro);
  });
}

function applyFocusParam() {
  if (!focusField) return;
  const fieldMap = {
    owner: "fieldOwner",
    dependency: "fieldDependency",
    next_checkpoint: "fieldCheckpoint",
    status: "fieldStatus",
    priority: "fieldPriority",
  };
  const targetId = fieldMap[focusField];
  const el = targetId && document.getElementById(targetId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
  }
}

async function initTaskPage() {
  if (!taskId) {
    document.getElementById("taskHeading").textContent = "Missing task id";
    document.getElementById("taskNotFound").style.display = "";
    document.getElementById("taskFieldsCard").style.display = "none";
    document.getElementById("activityCard").style.display = "none";
    document.getElementById("commentsCard").style.display = "none";
    document.getElementById("chatCard").style.display = "none";
    return;
  }

  agentsCache = await loadAgentCatalog();
  allTasksCache = await fetchAllTasks();
  await reloadTask();

  if (!currentTask) {
    document.getElementById("taskHeading").textContent = `${taskId} not found`;
    document.getElementById("taskNotFound").style.display = "";
    document.getElementById("taskFieldsCard").style.display = "none";
    document.getElementById("activityCard").style.display = "none";
    document.getElementById("commentsCard").style.display = "none";
    document.getElementById("chatCard").style.display = "none";
    return;
  }

  initFieldsForm();
  initCommentForm();
  initChat();
  applyFocusParam();
}

initTaskPage();



