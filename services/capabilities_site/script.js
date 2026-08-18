// Same-origin: server.js proxies /api, /health, /results, /self-learning to the backend.
const API_BASE = window.API_BASE_OVERRIDE || "";

function setActiveNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === path) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function staggerFade() {
  const items = document.querySelectorAll(".fade-up");
  items.forEach((item, i) => {
    item.style.animationDelay = `${i * 0.06}s`;
  });
}

async function loadAgentCatalog() {
  try {
    const response = await fetch(`${API_BASE}/api/agents`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.agents) && data.agents.length) {
        return data.agents;
      }
    }
  } catch (err) {
    // Fall through to static fallback
  }

  try {
    const response = await fetch("agents.json", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length) {
        return data;
      }
    }
  } catch (err) {
    // Ignore and use embedded payload as final fallback.
  }

  if (typeof AGENT_CATALOG !== "undefined" && Array.isArray(AGENT_CATALOG)) {
    return AGENT_CATALOG;
  }
  return [];
}

function renderDocumentationCatalog() {
  const grid = document.getElementById("documentationGrid");
  if (!grid) {
    return;
  }
  if (typeof DOC_TEMPLATE_CATALOG === "undefined" || !Array.isArray(DOC_TEMPLATE_CATALOG)) {
    grid.innerHTML = `<article class="card span-12"><p>Documentation catalog not loaded.</p></article>`;
    return;
  }

  grid.innerHTML = "";
  DOC_TEMPLATE_CATALOG.forEach((item) => {
    const article = document.createElement("article");
    article.className = "card span-6 fade-up doc-card";

    const h3 = document.createElement("h3");
    h3.textContent = item.category;

    const path = document.createElement("p");
    path.className = "doc-path";
    path.textContent = item.path;

    const list = document.createElement("ul");
    list.className = "doc-list";
    item.templates.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      list.appendChild(li);
    });

    article.append(h3, path, list);
    grid.appendChild(article);
  });
}

function renderWordTemplateCatalog() {
  const root = document.getElementById("wordTemplateGrid");
  if (!root) {
    return;
  }
  if (typeof WORD_TEMPLATE_CATALOG === "undefined" || !Array.isArray(WORD_TEMPLATE_CATALOG)) {
    root.innerHTML = `<article class="card span-12"><p>Word template catalog not loaded.</p></article>`;
    return;
  }

  root.innerHTML = "";
  WORD_TEMPLATE_CATALOG.forEach((group) => {
    const article = document.createElement("article");
    article.className = "card span-6 doc-card";

    const h3 = document.createElement("h3");
    h3.textContent = group.category;

    const list = document.createElement("ul");
    list.className = "doc-list doc-download-list";
    group.templates.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = item.file;
      a.setAttribute("download", "");
      a.textContent = item.name;
      li.appendChild(a);
      list.appendChild(li);
    });

    article.append(h3, list);
    root.appendChild(article);
  });
}

function getChatKey(agentKey) {
  return `agent-chat-${agentKey}`;
}

function getChatState(agentKey) {
  const raw = localStorage.getItem(getChatKey(agentKey));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveChatState(agentKey, messages) {
  localStorage.setItem(getChatKey(agentKey), JSON.stringify(messages));
}

function renderChatMessages(messages, root) {
  root.innerHTML = "";
  messages.forEach((msg) => {
    const line = document.createElement("div");
    line.className = `msg ${msg.role}`;
    line.textContent = msg.text;
    root.appendChild(line);
  });
  root.scrollTop = root.scrollHeight;
}

function updateStatusBadge(agentKey, status, label) {
  const badge = document.getElementById("chatAgentStatus");
  if (!badge) {
    return;
  }
  const normalized = (status || "ready").toLowerCase();
  const safeLabel = label || normalized || "ready";
  badge.textContent = safeLabel;
  badge.dataset.status = normalized;
  badge.classList.remove("ready", "busy", "blocked");
  badge.classList.add(normalized);

  const option = document.querySelector(`.agent-option[data-agent-key="${agentKey}"]`);
  if (option) {
    option.dataset.status = normalized;
  }
}

function initAgentChat(catalog) {
  const list = document.getElementById("agentList");
  const messagesRoot = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const sendButton = document.getElementById("sendChat");
  const clearButton = document.getElementById("clearChat");
  const nameRoot = document.getElementById("chatAgentName");
  const groupRoot = document.getElementById("chatAgentGroup");
  const focusRoot = document.getElementById("chatAgentFocus");
  const runCommandRoot = document.getElementById("chatRunCommand");
  const agentFileRoot = document.getElementById("chatAgentFile");
  const copyRunButton = document.getElementById("copyRunCommand");

  if (!list || !messagesRoot || !catalog.length) {
    return;
  }

  let activeAgent = null;

  function setActiveAgent(agent) {
    activeAgent = agent;
    nameRoot.textContent = agent.name;
    groupRoot.textContent = `${agent.group} • Agent ${agent.id}`;
    focusRoot.textContent = agent.focus;
    if (runCommandRoot) {
      runCommandRoot.textContent = agent.runCommand || "N/A";
    }
    if (agentFileRoot) {
      agentFileRoot.textContent = agent.agentFile || "N/A";
    }

    const status = agent.status || "ready";
    const statusLabel = agent.statusMessage || "Ready";
    updateStatusBadge(agent.key, status, statusLabel);

    document.querySelectorAll(".agent-option").forEach((node) => {
      node.classList.toggle("active", node.dataset.agentKey === agent.key);
    });

    const messages = getChatState(agent.key);
    if (!messages.length) {
      const intro = [{ role: "system", text: `${agent.name} ready. ${agent.prompt}` }];
      saveChatState(agent.key, intro);
      renderChatMessages(intro, messagesRoot);
      return;
    }
    renderChatMessages(messages, messagesRoot);
  }

  list.innerHTML = catalog
    .map((agent) => {
      const mode = agent.hasDedicatedRunner ? "Dedicated" : "Generic";
      const status = agent.status || "ready";
      return `<button type="button" class="agent-option" data-agent-key="${agent.key}" data-status="${status}"><span>${agent.id}</span><div><strong>${agent.name}</strong><small>${agent.group} • ${mode}</small></div></button>`;
    })
    .join("");

  list.querySelectorAll(".agent-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = catalog.find((agent) => agent.key === btn.dataset.agentKey);
      if (selected) {
        setActiveAgent(selected);
      }
    });
  });

  async function sendMessage() {
    if (!activeAgent) {
      return;
    }
    const text = chatInput.value.trim();
    if (!text) {
      return;
    }

    const messages = getChatState(activeAgent.key);
    messages.push({ role: "user", text });
    saveChatState(activeAgent.key, messages);
    renderChatMessages(messages, messagesRoot);
    chatInput.value = "";
    updateStatusBadge(activeAgent.key, "busy", "Generating...");

    try {
      const response = await fetch(`${API_BASE}/api/agents/${activeAgent.key}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, tool_actions: ["read_file", "grep_search"] }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Agent request failed");
      }
      messages.push({ role: "assistant", text: result.reply });
      saveChatState(activeAgent.key, messages);
      renderChatMessages(messages, messagesRoot);
      updateStatusBadge(activeAgent.key, result.status || "ready", result.status_message || "Ready");
    } catch (error) {
      messages.push({ role: "assistant", text: `${activeAgent.name}: I could not reach the live runtime. ${error.message}` });
      saveChatState(activeAgent.key, messages);
      renderChatMessages(messages, messagesRoot);
      updateStatusBadge(activeAgent.key, "blocked", "Runtime error");
    }
  }

  sendButton.addEventListener("click", sendMessage);
  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  clearButton.addEventListener("click", () => {
    if (!activeAgent) {
      return;
    }
    const reset = [{ role: "system", text: `${activeAgent.name} chat reset. ${activeAgent.prompt}` }];
    saveChatState(activeAgent.key, reset);
    renderChatMessages(reset, messagesRoot);
  });

  if (copyRunButton) {
    copyRunButton.addEventListener("click", async () => {
      if (!activeAgent || !activeAgent.runCommand) {
        return;
      }
      try {
        await navigator.clipboard.writeText(activeAgent.runCommand);
        copyRunButton.textContent = "Copied";
        setTimeout(() => {
          copyRunButton.textContent = "Copy Command";
        }, 1200);
      } catch (err) {
        copyRunButton.textContent = "Copy Failed";
        setTimeout(() => {
          copyRunButton.textContent = "Copy Command";
        }, 1200);
      }
    });
  }

  setActiveAgent(catalog[0]);
}

function initCrossCheck(catalog) {
  const primarySelect = document.getElementById("crossCheckPrimaryAgent");
  const peerSelect = document.getElementById("crossCheckPeerAgent");
  const runButton = document.getElementById("runCrossCheck");
  const promptInput = document.getElementById("crossCheckPrompt");
  const summaryEl = document.getElementById("crossCheckSummary");

  if (!primarySelect || !peerSelect || !runButton || !summaryEl || !catalog.length) {
    return;
  }

  const options = catalog
    .map((agent) => `<option value="${agent.key}">${agent.name}</option>`)
    .join("");
  primarySelect.innerHTML = options;
  peerSelect.innerHTML = options;
  primarySelect.value = catalog[0].key;
  peerSelect.value = catalog[1]?.key || catalog[0].key;

  runButton.addEventListener("click", async () => {
    const primaryAgent = primarySelect.value;
    const peerAgent = peerSelect.value;
    const turnCap = Number(document.getElementById("crossCheckTurnCap").value || 2);
    const prompt = promptInput.value.trim() || "Review the proposal for risks and next actions.";

    summaryEl.textContent = "Running peer review...";
    runButton.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/agents/cross-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_agent: primaryAgent,
          peer_agent: peerAgent,
          turn_cap: turnCap,
          prompt,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Cross-check failed");
      }
      summaryEl.textContent = result.summary || "No summary returned.";
    } catch (error) {
      summaryEl.textContent = `Cross-check failed: ${error.message}`;
    } finally {
      runButton.disabled = false;
    }
  });
}

async function initSite() {
  setActiveNav();
  staggerFade();
  renderDocumentationCatalog();
  renderWordTemplateCatalog();
  const catalog = await loadAgentCatalog();
  initCrossCheck(catalog);
  initAgentChat(catalog);
}

initSite();