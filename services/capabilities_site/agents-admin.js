// Agent directory admin: list/search/filter agents from the aisena_agents Postgres
// table (via /api/agents), create new agents, delete agents, and link to the
// per-agent detail/edit page. Single source of truth: /api/agents.
const AGENT_GROUPS = ["Core Delivery", "Engineering", "Domain SMEs", "Expanded Delivery", "Domain-Agnostic Framework"];

let agentsCache = [];

async function fetchAgents() {
  try {
    const response = await fetch(`${API_BASE}/api/agents`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.agents) ? data.agents : [];
  } catch (err) {
    return [];
  }
}

function setNotice(message, tone) {
  const el = document.getElementById("agentsNotice");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("ok", "warn");
  el.classList.add(tone || "ok");
}

function readFilters() {
  return {
    q: document.getElementById("filterText").value.trim().toLowerCase(),
    group: document.getElementById("filterGroup").value,
  };
}

function applyFilters(agents, filters) {
  return agents.filter((agent) => {
    if (filters.q) {
      const haystack = `${agent.name || ""} ${agent.focus || ""}`.toLowerCase();
      if (!haystack.includes(filters.q)) return false;
    }
    if (filters.group && agent.group !== filters.group) return false;
    return true;
  });
}

function populateGroupFilter() {
  const groups = Array.from(new Set(agentsCache.map((a) => a.group).filter(Boolean))).sort();
  const select = document.getElementById("filterGroup");
  select.innerHTML = `<option value="">All Groups</option>` + groups.map((g) => `<option value="${g}">${g}</option>`).join("");
}

function renderAgents() {
  const body = document.getElementById("agentsBody");
  if (!body) return;
  const filters = readFilters();
  const filtered = applyFilters(agentsCache, filters);

  if (!filtered.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="5">No agents match this view.</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map(
      (agent) => `<tr data-agent-id="${agent.id}">
        <td><a class="task-link" href="agent-detail.html?key=${encodeURIComponent(agent.key)}">${agent.id} ${agent.name}</a></td>
        <td><span class="pill">${agent.group || "-"}</span></td>
        <td>${agent.focus || "-"}</td>
        <td>${agent.hasDedicatedRunner ? "Dedicated" : "Generic"}</td>
        <td>
          <a class="ghost" href="agent-detail.html?key=${encodeURIComponent(agent.key)}" style="text-decoration:none; display:inline-block; padding:9px 15px; border-radius:11px;">Edit</a>
          <button type="button" class="ghost agent-delete" data-agent-key="${agent.key}">Delete</button>
        </td>
      </tr>`
    )
    .join("");

  body.querySelectorAll(".agent-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteAgent(btn.dataset.agentKey));
  });
}

async function deleteAgent(agentKey) {
  const agent = agentsCache.find((a) => a.key === agentKey);
  if (!agent || !window.confirm(`Delete ${agent.name} (${agent.key})? This cannot be undone.`)) return;
  try {
    const response = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentKey)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Delete failed");
    agentsCache = agentsCache.filter((a) => a.key !== agentKey);
    populateGroupFilter();
    renderAgents();
    setNotice(`${agent.name} deleted.`, "warn");
  } catch (err) {
    setNotice(`Could not delete ${agent.name}: ${err.message}`, "warn");
  }
}

function initFilterBar() {
  ["filterText", "filterGroup"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderAgents);
    document.getElementById(id).addEventListener("change", renderAgents);
  });
  document.getElementById("filterClear").addEventListener("click", () => {
    document.getElementById("filterText").value = "";
    document.getElementById("filterGroup").value = "";
    renderAgents();
  });
}

function initAgentDialog() {
  const dialog = document.getElementById("agentDialog");
  const form = document.getElementById("agentForm");
  const cancelBtn = document.getElementById("agentDialogCancel");
  if (!dialog || !form) return;

  cancelBtn.addEventListener("click", () => dialog.close());

  document.getElementById("quickAddAgent")?.addEventListener("click", () => {
    form.reset();
    document.getElementById("agentGroup").innerHTML = AGENT_GROUPS.map((g) => `<option value="${g}">${g}</option>`).join("");
    dialog.showModal();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("agentName").value.trim();
    if (!name) return;

    const payload = {
      name,
      key: document.getElementById("agentKey").value.trim() || undefined,
      group: document.getElementById("agentGroup").value,
      focus: document.getElementById("agentFocus").value.trim(),
      prompt: document.getElementById("agentPrompt").value.trim(),
    };

    try {
      const response = await fetch(`${API_BASE}/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Create failed");
      agentsCache.push(result.agent);
      populateGroupFilter();
      renderAgents();
      setNotice(`${result.agent.name} added to the directory.`, "ok");
      dialog.close();
      form.reset();
    } catch (err) {
      setNotice(`Could not create agent: ${err.message}`, "warn");
    }
  });
}

async function initAgentsAdminPage() {
  agentsCache = await fetchAgents();
  populateGroupFilter();
  initFilterBar();
  initAgentDialog();
  renderAgents();
}

initAgentsAdminPage();
