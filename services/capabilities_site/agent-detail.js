// Agent detail page: editable metadata (name, group, focus, prompt, run command)
// and the full AGENT.md role-definition text, all backed by the aisena_agents
// Postgres table via /api/agents/:key.
const AGENT_GROUPS = ["Core Delivery", "Engineering", "Domain SMEs", "Expanded Delivery", "Domain-Agnostic Framework"];

const params = new URLSearchParams(window.location.search);
const agentKey = params.get("key");

let currentAgent = null;

function formatTimestamp(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

async function fetchAgent(key) {
  try {
    const response = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    return data.agent || null;
  } catch (err) {
    return null;
  }
}

function renderHeader(agent) {
  document.getElementById("agentHeading").textContent = `${agent.id}: ${agent.name}`;
  document.getElementById("agentSubtitle").textContent = `${agent.group || "Unassigned group"} • ${agent.key}`;
  document.getElementById("agentKeyLabel").textContent = agent.key;
  document.getElementById("agentCreatedAt").textContent = formatTimestamp(agent.created_at);
  document.getElementById("agentUpdatedAt").textContent = formatTimestamp(agent.updated_at);
}

function renderFields(agent) {
  document.getElementById("fieldName").value = agent.name || "";
  document.getElementById("fieldFocus").value = agent.focus || "";
  document.getElementById("fieldPrompt").value = agent.prompt || "";
  document.getElementById("fieldRunCommand").value = agent.runCommand || "";

  const groupSelect = document.getElementById("fieldGroup");
  groupSelect.innerHTML = AGENT_GROUPS.map((g) => `<option value="${g}">${g}</option>`).join("");
  if (agent.group && !AGENT_GROUPS.includes(agent.group)) {
    groupSelect.innerHTML += `<option value="${agent.group}">${agent.group}</option>`;
  }
  groupSelect.value = agent.group || "";

  document.getElementById("fieldContent").value = agent.content || "";
}

function initFieldsForm() {
  const saveBtn = document.getElementById("saveAgentFields");
  const statusEl = document.getElementById("agentSaveStatus");

  saveBtn.addEventListener("click", async () => {
    const payload = {
      name: document.getElementById("fieldName").value.trim(),
      group: document.getElementById("fieldGroup").value,
      focus: document.getElementById("fieldFocus").value.trim(),
      prompt: document.getElementById("fieldPrompt").value.trim(),
      runCommand: document.getElementById("fieldRunCommand").value.trim(),
    };

    statusEl.textContent = "Saving...";
    statusEl.classList.remove("ok");
    try {
      const response = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Save failed");
      currentAgent = result.agent;
      renderHeader(currentAgent);
      statusEl.textContent = "Saved.";
      statusEl.classList.add("ok");
    } catch (err) {
      statusEl.textContent = `Save failed: ${err.message}`;
    }
  });
}

function initContentForm() {
  const saveBtn = document.getElementById("saveAgentContent");
  const statusEl = document.getElementById("agentContentSaveStatus");

  saveBtn.addEventListener("click", async () => {
    const payload = { content: document.getElementById("fieldContent").value };

    statusEl.textContent = "Saving...";
    statusEl.classList.remove("ok");
    try {
      const response = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Save failed");
      currentAgent = result.agent;
      renderHeader(currentAgent);
      statusEl.textContent = "Saved.";
      statusEl.classList.add("ok");
    } catch (err) {
      statusEl.textContent = `Save failed: ${err.message}`;
    }
  });
}

async function initAgentDetailPage() {
  if (!agentKey) {
    document.getElementById("agentHeading").textContent = "Missing agent key";
    document.getElementById("agentNotFound").style.display = "";
    document.getElementById("agentFieldsCard").style.display = "none";
    document.getElementById("agentContentCard").style.display = "none";
    return;
  }

  currentAgent = await fetchAgent(agentKey);
  if (!currentAgent) {
    document.getElementById("agentHeading").textContent = `${agentKey} not found`;
    document.getElementById("agentNotFound").style.display = "";
    document.getElementById("agentFieldsCard").style.display = "none";
    document.getElementById("agentContentCard").style.display = "none";
    return;
  }

  renderHeader(currentAgent);
  renderFields(currentAgent);
  initFieldsForm();
  initContentForm();
}

initAgentDetailPage();
