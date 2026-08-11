function setActiveNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === path) {
      link.classList.add("active");
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
    const response = await fetch("agents.json", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length) {
        return data;
      }
    }
  } catch (err) {
    // Fall through to static fallback
  }

  if (typeof AGENT_CATALOG !== "undefined" && Array.isArray(AGENT_CATALOG)) {
    return AGENT_CATALOG;
  }
  return [];
}

function renderAgentDirectory(catalog) {
  const container = document.getElementById("agentDirectory");
  if (!container || !catalog.length) {
    return;
  }

  const groups = {};
  catalog.forEach((agent) => {
    if (!groups[agent.group]) {
      groups[agent.group] = [];
    }
    groups[agent.group].push(agent);
  });

  container.innerHTML = Object.keys(groups)
    .map((groupName) => {
      const items = groups[groupName]
        .map((agent) => {
          const runnerTag = agent.hasDedicatedRunner ? "Dedicated runner" : "Generic runner";
          return `<div class="agent-chip"><span>${agent.id}</span><div><strong>${agent.name}</strong><small>${agent.focus}</small><small>${runnerTag}: ${agent.runCommand}</small></div></div>`;
        })
        .join("");
      return `<section class="agent-group-card"><h4>${groupName}</h4>${items}</section>`;
    })
    .join("");
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

  grid.innerHTML = DOC_TEMPLATE_CATALOG.map((item) => {
    const list = item.templates.map((t) => `<li>${t}</li>`).join("");
    return `<article class="card span-6 fade-up doc-card"><h3>${item.category}</h3><p class="doc-path">${item.path}</p><ul class="doc-list">${list}</ul></article>`;
  }).join("");
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

  root.innerHTML = WORD_TEMPLATE_CATALOG.map((group) => {
    const links = group.templates
      .map((item) => `<li><a href="${item.file}" download>${item.name}</a></li>`)
      .join("");
    return `<article class="card span-6 doc-card"><h3>${group.category}</h3><ul class="doc-list doc-download-list">${links}</ul></article>`;
  }).join("");
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

function agentReply(agent, userText) {
  const lower = userText.toLowerCase();
  if (lower.includes("run") || lower.includes("start") || lower.includes("launch")) {
    return `${agent.name}: Run me from terminal with: ${agent.runCommand} (fallback: ${agent.runCommandFallback})`;
  }
  if (lower.includes("status") || lower.includes("progress")) {
    return `${agent.name}: Current recommendation is to define objective, acceptance criteria, and next measurable checkpoint.`;
  }
  if (lower.includes("test") || lower.includes("qa")) {
    return `${agent.name}: Add a targeted test slice first, then expand to integration and regression coverage.`;
  }
  if (lower.includes("risk") || lower.includes("security") || lower.includes("compliance")) {
    return `${agent.name}: Document the risk, assign severity, and route through the correct approval gate before execution.`;
  }
  return `${agent.name}: I can help with ${agent.focus.toLowerCase()} Starter prompt: "${agent.prompt}"`;
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
      return `<button type="button" class="agent-option" data-agent-key="${agent.key}"><span>${agent.id}</span><div><strong>${agent.name}</strong><small>${agent.group} • ${mode}</small></div></button>`;
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

  function sendMessage() {
    if (!activeAgent) {
      return;
    }
    const text = chatInput.value.trim();
    if (!text) {
      return;
    }
    const messages = getChatState(activeAgent.key);
    messages.push({ role: "user", text });
    messages.push({ role: "assistant", text: agentReply(activeAgent, text) });
    saveChatState(activeAgent.key, messages);
    renderChatMessages(messages, messagesRoot);
    chatInput.value = "";
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

async function initSite() {
  setActiveNav();
  staggerFade();
  renderDocumentationCatalog();
  renderWordTemplateCatalog();
  const catalog = await loadAgentCatalog();
  renderAgentDirectory(catalog);
  initAgentChat(catalog);
}

initSite();