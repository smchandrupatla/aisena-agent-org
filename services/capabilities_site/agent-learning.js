// Tracks the last-seen snapshot timestamp for change-detection polling.
let _lastGeneratedAt = null;

function normalizeLearningRows(data) {
  const agents = data?.agents || {};
  return Object.keys(agents)
    .sort()
    .map((agentKey) => {
      const entry = agents[agentKey] || {};
      return {
        agent: agentKey,
        updatedAt: entry.updated_at || "-",
        learning: entry.latest_learning || "-",
        context: entry.context || "-",
        evidence: entry.evidence || "-",
      };
    });
}

// Same-origin first: server.js proxies /self-learning/trigger to the backend.
const TRIGGER_API_BASES = [window.AGENT_LEARNING_API_BASE, ""].filter(
  (base) => base !== undefined && base !== null
);

async function postTrigger(payload) {
  let lastError = null;

  for (const base of TRIGGER_API_BASES) {
    try {
      const response = await fetch(`${base}/self-learning/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("No trigger API base available");
}

function setTriggerStatus(message, tone) {
  const statusEl = document.getElementById("triggerLearningStatus");
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  statusEl.classList.remove("ok", "error");
  if (tone) {
    statusEl.classList.add(tone);
  }
}

function updateAgentOptions(rows) {
  const select = document.getElementById("triggerAgentSelect");
  if (!select) {
    return;
  }

  const current = select.value;
  const options = ['<option value="">Select an agent</option>']
    .concat(rows.map((row) => `<option value="${row.agent}">${row.agent}</option>`));
  select.innerHTML = options.join("");

  if (rows.some((row) => row.agent === current)) {
    select.value = current;
  }
}

async function triggerSelfLearning() {
  const select = document.getElementById("triggerAgentSelect");
  const button = document.getElementById("triggerLearningBtn");

  if (!select || !button) {
    return;
  }

  const agent = select.value;
  if (!agent) {
    setTriggerStatus("Select an agent first.", "error");
    return;
  }

  const learning = window.prompt("Learning insight to record:", "Manual learning trigger from portal");
  if (learning === null) {
    return;
  }
  const context = window.prompt("Context:", "agent-learning page") ?? "agent-learning page";
  const evidence = window.prompt("Evidence:", "services/capabilities_site/agent-learning.html") ?? "services/capabilities_site/agent-learning.html";

  button.disabled = true;
  setTriggerStatus("Triggering...", "");

  try {
    await postTrigger({
      agent,
      learning,
      context,
      evidence,
    });

    setTriggerStatus("Self learning recorded and snapshot synced.", "ok");
    await renderAgentLearning();
  } catch (err) {
    setTriggerStatus(
      "Trigger failed. Ensure self-learning API is running.",
      "error"
    );
  } finally {
    button.disabled = false;
  }
}

async function renderAgentLearning() {
  const body = document.getElementById("agentLearningBody");
  const generated = document.getElementById("learningGeneratedAt");
  const total = document.getElementById("learningTotalCount");

  if (!body) {
    return;
  }

  try {
    const response = await fetch("agent-self-learning-latest.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const rows = normalizeLearningRows(payload);

    // Track the snapshot timestamp so the poller knows what's already shown.
    _lastGeneratedAt = payload.generated_at || null;

    generated.textContent = payload.generated_at || "-";
    total.textContent = String(rows.length);
    updateAgentOptions(rows);

    body.innerHTML = rows
      .map(
        (row) => `<tr>
          <td>${row.agent}</td>
          <td>${row.updatedAt}</td>
          <td>${row.learning}</td>
          <td>${row.context}</td>
          <td>${row.evidence}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5">Unable to load learning snapshot. Run sync_self_learning.py and refresh.</td></tr>`;
    generated.textContent = "-";
    total.textContent = "0";
  }
}

const triggerButton = document.getElementById("triggerLearningBtn");
if (triggerButton) {
  triggerButton.addEventListener("click", triggerSelfLearning);
}

renderAgentLearning();

// Auto-refresh: poll every 60 seconds and re-render only when generated_at changes.
async function pollForLearningUpdates() {
  try {
    const response = await fetch("agent-self-learning-latest.json", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const ts = payload?.generated_at || null;
    if (ts && ts !== _lastGeneratedAt) {
      _lastGeneratedAt = ts;
      await renderAgentLearning();
    }
  } catch (_) {
    // silent — network may be unavailable
  }
}

setInterval(pollForLearningUpdates, 60_000);
