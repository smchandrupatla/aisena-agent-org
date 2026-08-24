// Same-origin: server.js proxies /api, /health, /results, /self-learning to the backend.
const API_BASE = window.API_BASE_OVERRIDE || "";

function ensurePromptNavigation() {
  document.querySelectorAll("nav").forEach((nav) => {
    if (nav.querySelector('a[href="/prompts"], a[href="prompts"]')) return;
    const link = document.createElement("a");
    link.href = "/prompts";
    link.textContent = "Prompt Library";
    const issues = Array.from(nav.querySelectorAll("a")).find((item) => (item.getAttribute("href") || "").includes("issues"));
    if (issues) issues.insertAdjacentElement("afterend", link);
    else nav.appendChild(link);
  });
}

function setActiveNav() {
  ensurePromptNavigation();
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav a").forEach((link) => {
    const href = link.getAttribute("href");
    const isPromptRoute = href === "/prompts" && window.location.pathname.startsWith("/prompts");
    if (href === path || isPromptRoute) {
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

function initModernFeatures() {
  // Initialize modern navigation behavior
  setActiveNav();
  initContextBackButton();
  
  // Initialize stagger animations
  staggerFade();
  
  // Add smooth scrolling
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
  
  // Initialize card hover effects
  const cards = document.querySelectorAll('.card, .vp-item');
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-4px)';
      this.style.transition = 'all 0.3s ease';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = '';
    });
  });
  
  // Initialize CTA button tracking
  const ctaButton = document.querySelector('.cta-button');
  if (ctaButton) {
    ctaButton.addEventListener('click', function() {
      // Track CTA clicks for analytics
      if (typeof gtag !== 'undefined') {
        gtag('event', 'cta_click', {
          'event_category': 'engagement',
          'event_label': 'create_new_app'
        });
      }
    });
  }
}

function initContextBackButton() {
  const main = document.querySelector("main");
  if (!main || main.querySelector(".context-back")) {
    return;
  }

  const row = document.createElement("div");
  row.className = "context-back-row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "context-back ghost";
  button.setAttribute("aria-label", "Return to the previous page");
  button.textContent = "← Back";
  button.addEventListener("click", () => {
    if (document.referrer && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "index.html";
  });
  row.appendChild(button);
  main.prepend(row);
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

async function loadDatabaseTables() {
  const container = document.getElementById("tablesContainer");
  if (!container) {
    return;
  }

  const aisenaPanel = document.getElementById("aisenaTablesPanel");
  const applicationPanel = document.getElementById("applicationTablesPanel");
  const aisenaTab = document.getElementById("aisenaTablesTab");
  const applicationTab = document.getElementById("applicationTablesTab");
  const dataContainer = document.getElementById("tableDataContainer");
  const selectedName = document.getElementById("selectedTableName");
  const selectedCount = document.getElementById("selectedTableCount");

  const showMessage = (root, message, className = "notice") => {
    const paragraph = document.createElement("p");
    paragraph.className = className;
    paragraph.textContent = message;
    root.replaceChildren(paragraph);
  };

  const loadTableContents = async (tableName, button) => {
    document.querySelectorAll(".db-table-button.active").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedName.textContent = tableName;
    selectedCount.textContent = "Loading";
    showMessage(dataContainer, "Loading table content...");

    try {
      const response = await fetch(`${API_BASE}/db-tables/${encodeURIComponent(tableName)}?limit=100`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to load table content");
      }

      selectedCount.textContent = `${result.rows.length} row${result.rows.length === 1 ? "" : "s"}`;
      if (!result.rows.length) {
        showMessage(dataContainer, "This table contains no rows.");
        return;
      }

      const table = document.createElement("table");
      table.className = "table db-data-table";
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      result.columns.forEach((column) => {
        const cell = document.createElement("th");
        cell.textContent = column;
        headRow.appendChild(cell);
      });
      head.appendChild(headRow);

      const body = document.createElement("tbody");
      result.rows.forEach((row) => {
        const tableRow = document.createElement("tr");
        row.forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value === null ? "NULL" : String(value);
          if (value === null) {
            cell.className = "db-null";
          }
          tableRow.appendChild(cell);
        });
        body.appendChild(tableRow);
      });
      table.append(head, body);
      dataContainer.replaceChildren(table);
    } catch (error) {
      selectedCount.textContent = "Error";
      showMessage(dataContainer, `Could not load table content: ${error.message}`, "notice error");
    }
  };

  const renderTableGroup = (root, tables, emptyMessage) => {
    if (!tables.length) {
      showMessage(root, emptyMessage);
      return;
    }
    const list = document.createElement("div");
    list.className = "db-table-list";
    tables.forEach((tableName) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "db-table-button";
      button.textContent = tableName;
      button.addEventListener("click", () => loadTableContents(tableName, button));
      list.appendChild(button);
    });
    root.replaceChildren(list);
  };

  const activateTab = (activeTab, activePanel, inactiveTab, inactivePanel) => {
    activeTab.classList.add("active");
    activeTab.setAttribute("aria-selected", "true");
    activePanel.hidden = false;
    inactiveTab.classList.remove("active");
    inactiveTab.setAttribute("aria-selected", "false");
    inactivePanel.hidden = true;
  };

  aisenaTab.addEventListener("click", () => activateTab(aisenaTab, aisenaPanel, applicationTab, applicationPanel));
  applicationTab.addEventListener("click", () => activateTab(applicationTab, applicationPanel, aisenaTab, aisenaPanel));

  try {
    const response = await fetch(`${API_BASE}/db-tables`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to load database tables");
    }

    const aisenaTables = Array.isArray(result.aisena_tables) ? result.aisena_tables : [];
    const applicationTables = Array.isArray(result.application_tables) ? result.application_tables : [];
    renderTableGroup(aisenaPanel, aisenaTables, "No AISENA tables found.");
    renderTableGroup(applicationPanel, applicationTables, "No application tables found.");
    const firstButton = aisenaPanel.querySelector(".db-table-button") || applicationPanel.querySelector(".db-table-button");
    if (firstButton) {
      firstButton.click();
    }
  } catch (error) {
    showMessage(aisenaPanel, `Could not load database tables: ${error.message}`, "notice error");
  }
}

function initObservabilityViewers() {
  document.querySelectorAll(".observability-viewer").forEach((viewer) => {
    const endpoint = viewer.dataset.observabilityEndpoint;
    const provider = viewer.dataset.observabilityProvider;
    const queryInput = viewer.querySelector(".observability-query input");
    const refreshButton = viewer.querySelector(".observability-refresh");
    const status = viewer.querySelector("[data-observability-status]");
    const count = viewer.querySelector("[data-observability-count]");
    const message = viewer.querySelector("[data-observability-message]");
    const eventsRoot = viewer.querySelector("[data-observability-events]");

    const setStatus = (value) => {
      const labels = {
        connected: "Connected",
        not_configured: "Not configured",
        unavailable: "Unavailable",
        loading: "Loading",
      };
      status.textContent = labels[value] || value;
      status.className = "status-badge";
      status.classList.add(value === "connected" ? "status-passed" : value === "loading" ? "status-running" : value === "unavailable" ? "status-error" : "status-not_run");
    };

    const renderEvents = (events) => {
      eventsRoot.replaceChildren();
      if (!events.length) {
        const empty = document.createElement("p");
        empty.textContent = "No matching events found in the last 24 hours.";
        eventsRoot.appendChild(empty);
        return;
      }

      const table = document.createElement("table");
      table.className = "table observability-table";
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      ["Time", "Service", "Source", "Message"].forEach((label) => {
        const cell = document.createElement("th");
        cell.textContent = label;
        headRow.appendChild(cell);
      });
      head.appendChild(headRow);
      const body = document.createElement("tbody");
      events.forEach((event) => {
        const row = document.createElement("tr");
        const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleString() : "-";
        [timestamp, event.service || "-", event.source || "-", event.message || ""].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        });
        body.appendChild(row);
      });
      table.append(head, body);
      eventsRoot.appendChild(table);
    };

    const loadEvents = async () => {
      setStatus("loading");
      refreshButton.disabled = true;
      message.textContent = `Loading ${provider} events...`;
      try {
        const params = new URLSearchParams({ query: queryInput.value.trim(), limit: "50" });
        const response = await fetch(`${API_BASE}${endpoint}?${params}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || `Unable to load ${provider} events`);
        }
        const events = Array.isArray(result.events) ? result.events : [];
        setStatus(result.status || "unavailable");
        count.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
        message.textContent = result.message || (result.status === "connected" ? `Showing events from ${provider}.` : `${provider} is not ready.`);
        renderEvents(events);
      } catch (error) {
        setStatus("unavailable");
        count.textContent = "0 events";
        message.textContent = `Could not load ${provider} events: ${error.message}`;
        renderEvents([]);
      } finally {
        refreshButton.disabled = false;
      }
    };

    refreshButton.addEventListener("click", loadEvents);
    queryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadEvents();
      }
    });
    loadEvents();
  });
}

// Initialize modern features when DOM is ready
document.addEventListener('DOMContentLoaded', initModernFeatures);

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
  loadDatabaseTables();
  initObservabilityViewers();
  const catalog = await loadAgentCatalog();
  initCrossCheck(catalog);
  initAgentChat(catalog);
}

initSite();