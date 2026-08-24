const promptApp = document.getElementById("promptApp");
const promptState = { session: null, meta: null, queryTimer: null };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function toast(message, tone = "success") {
  const element = document.getElementById("promptToast");
  element.textContent = message;
  element.className = `prompt-toast show ${tone}`;
  window.setTimeout(() => { element.className = "prompt-toast"; }, 3200);
}

function loading(label = "Loading...") {
  promptApp.innerHTML = `<section class="prompt-loading" role="status"><span class="prompt-spinner" aria-hidden="true"></span><p>${escapeHtml(label)}</p></section>`;
}

function renderError(error, retry) {
  promptApp.innerHTML = `<section class="prompt-state prompt-error" role="alert">
    <h1>Something went wrong</h1><p>${escapeHtml(error.message || error)}</p>
    ${retry ? '<button type="button" id="promptRetry">Try again</button>' : '<a class="prompt-button" href="/prompts">Return to Prompt Library</a>'}
  </section>`;
  document.getElementById("promptRetry")?.addEventListener("click", retry);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.fields = payload.fields || {};
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function ensureContext() {
  const [session, meta] = await Promise.all([
    promptState.session ? Promise.resolve(promptState.session) : api("/api/prompts/session"),
    promptState.meta ? Promise.resolve(promptState.meta) : api("/api/prompts/meta"),
  ]);
  promptState.session = session;
  promptState.meta = meta;
}

function pageHeading(kicker, title, description, actions = "") {
  return `<section class="prompt-heading fade-up">
    <div><div class="prompt-kicker">${escapeHtml(kicker)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>
    ${actions ? `<div class="prompt-heading-actions">${actions}</div>` : ""}
  </section>`;
}

function statusBadge(status) {
  return `<span class="prompt-status status-${escapeHtml(status).toLowerCase()}">${escapeHtml(status)}</span>`;
}

function tagList(tags) {
  if (!tags?.length) return '<span class="prompt-muted">No tags</span>';
  return `<span class="prompt-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</span>`;
}

function actionButtons(prompt, compact = false) {
  const allowed = prompt.permissions || { edit: true, delete: true };
  const archiveAction = prompt.status === "Archived"
    ? `<button type="button" class="ghost" data-prompt-action="restore" data-id="${prompt.id}">Restore</button>`
    : `<button type="button" class="ghost" data-prompt-action="archive" data-id="${prompt.id}">Archive</button>`;
  return `<div class="prompt-actions ${compact ? "compact" : ""}">
    <a class="ghost" href="/prompts/${prompt.id}">View</a>
    <button type="button" class="ghost" data-prompt-action="copy" data-id="${prompt.id}">Copy</button>
    ${allowed.edit ? `<a class="ghost" href="/prompts/${prompt.id}/edit">Edit</a><button type="button" class="ghost" data-prompt-action="duplicate" data-id="${prompt.id}">Duplicate</button>${archiveAction}` : ""}
    ${allowed.delete ? `<button type="button" class="ghost danger" data-prompt-action="delete" data-id="${prompt.id}">Delete</button>` : ""}
    <button type="button" class="prompt-button" data-prompt-action="run" data-id="${prompt.id}">Run Prompt</button>
  </div>`;
}

function bindPromptActions(afterAction) {
  document.querySelectorAll("[data-prompt-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { promptAction: action, id } = button.dataset;
      const confirmations = {
        archive: "Archive this prompt?",
        restore: "Restore this prompt to Draft?",
        delete: "Delete this prompt? It will be removed from normal views.",
      };
      if (confirmations[action] && !window.confirm(confirmations[action])) return;
      button.disabled = true;
      try {
        if (action === "copy") {
          const result = await api(`/api/prompts/${id}/copy`, { method: "POST", body: "{}" });
          await navigator.clipboard.writeText(result.prompt_text);
          toast("Prompt copied. Usage count updated.");
        } else if (action === "duplicate") {
          const result = await api(`/api/prompts/${id}/duplicate`, { method: "POST", body: "{}" });
          toast(`${result.prompt.prompt_code} created.`);
          window.location.href = `/prompts/${result.prompt.id}/edit`;
          return;
        } else if (action === "delete") {
          await api(`/api/prompts/${id}`, { method: "DELETE" });
          toast("Prompt deleted.");
          if (afterAction) await afterAction(action);
          else window.location.href = "/prompts";
          return;
        } else {
          await api(`/api/prompts/${id}/${action}`, { method: "POST", body: "{}" });
          toast(action === "archive" ? "Prompt archived." : "Prompt restored.");
        }
        if (afterAction) await afterAction(action);
      } catch (error) {
        toast(error.message, "error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

function currentFilters() {
  const form = document.getElementById("promptFilters");
  const values = new FormData(form);
  const params = new URLSearchParams();
  for (const [key, value] of values.entries()) {
    if (value) params.append(key, value);
  }
  params.set("page", form.dataset.page || "1");
  params.set("per_page", "12");
  return params;
}

async function loadPromptList() {
  const list = document.getElementById("promptResults");
  list.setAttribute("aria-busy", "true");
  list.innerHTML = '<div class="prompt-inline-loading"><span class="prompt-spinner"></span>Loading prompts...</div>';
  try {
    const data = await api(`/api/prompts?${currentFilters()}`);
    const pagination = data.pagination;
    document.getElementById("promptResultCount").textContent = `${pagination.total} prompt${pagination.total === 1 ? "" : "s"}`;
    if (!data.prompts.length) {
      list.innerHTML = `<section class="prompt-state prompt-empty"><h2>No prompts found</h2><p>Adjust the filters or create a prompt for this library.</p>${promptState.session.permissions.create ? '<a class="prompt-button" href="/prompts/new">Create Prompt</a>' : ""}</section>`;
    } else {
      list.innerHTML = `<div class="prompt-card-grid">${data.prompts.map((prompt) => `<article class="prompt-card">
        <div class="prompt-card-top"><code>${escapeHtml(prompt.prompt_code)}</code>${statusBadge(prompt.status)}</div>
        <h2><a href="/prompts/${prompt.id}">${escapeHtml(prompt.title)}</a></h2>
        <p>${escapeHtml(prompt.description || "No description")}</p>
        <dl class="prompt-card-meta">
          <div><dt>Category</dt><dd>${escapeHtml(prompt.category || "Uncategorized")}</dd></div>
          <div><dt>Owner</dt><dd>${escapeHtml(prompt.owner_name)}</dd></div>
          <div><dt>Agent</dt><dd>${escapeHtml(prompt.assignee_agent_name || "Unassigned")}</dd></div>
          <div><dt>Version / Uses</dt><dd>v${prompt.version} / ${prompt.usage_count}</dd></div>
        </dl>
        ${tagList(prompt.tags)}
        <div class="prompt-card-footer"><time datetime="${escapeHtml(prompt.updated_at)}">Updated ${escapeHtml(formatDate(prompt.updated_at))}</time>
          <label class="prompt-run-label" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#29466f;cursor:pointer;">
            <input type="checkbox" class="prompt-run-check" data-id="${prompt.id}" aria-label="Select ${escapeHtml(prompt.title)} to run" style="width:18px;height:18px;">
            <span>Run</span>
          </label>
          ${actionButtons(prompt, true)}
        </div>
      </article>`).join("")}</div>`;
    }
    document.getElementById("promptPagination").innerHTML = `<button type="button" class="ghost" id="previousPage" ${pagination.page <= 1 ? "disabled" : ""}>Previous</button><span>Page ${pagination.page} of ${Math.max(1, pagination.pages)}</span><button type="button" class="ghost" id="nextPage" ${pagination.page >= pagination.pages ? "disabled" : ""}>Next</button>`;
    document.getElementById("previousPage").addEventListener("click", () => changePage(pagination.page - 1));
    document.getElementById("nextPage").addEventListener("click", () => changePage(pagination.page + 1));
    bindPromptActions(loadPromptList);
  } catch (error) {
    list.innerHTML = `<section class="prompt-state prompt-error" role="alert"><h2>Could not load prompts</h2><p>${escapeHtml(error.message)}</p><button type="button" id="listRetry">Try again</button></section>`;
    document.getElementById("listRetry").addEventListener("click", loadPromptList);
  } finally {
    list.removeAttribute("aria-busy");
  }
}

function changePage(page) {
  document.getElementById("promptFilters").dataset.page = String(page);
  loadPromptList();
  document.getElementById("promptResults").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function renderLibrary() {
  loading("Loading Prompt Library...");
  try {
    await ensureContext();
    const meta = promptState.meta;
    promptApp.innerHTML = pageHeading("Reusable knowledge", "Prompt Library", "Find, version, and assign trusted prompts across the agent organization.", promptState.session.permissions.create ? '<a class="prompt-button" href="/prompts/new">Create Prompt</a>' : "") + `
      <section class="prompt-toolbar fade-up">
        <form id="promptFilters" data-page="1">
          <label class="prompt-search"><span>Search</span><input type="search" name="q" placeholder="Search prompts, text, categories, or tags"></label>
          <label><span>Category</span><select name="category"><option value="">All categories</option>${meta.categories.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></label>
          <label><span>Tags</span><select name="tag"><option value="">All tags</option>${meta.tags.map((item) => `<option>${escapeHtml(item.name)}</option>`).join("")}</select></label>
          <label><span>Status</span><select name="status"><option value="">All statuses</option><option>Draft</option><option>Active</option><option>Archived</option></select></label>
          <label><span>Owner</span><select name="owner"><option value="">All owners</option>${meta.owners.map((item) => `<option value="${item.id}">${escapeHtml(item.display_name)}</option>`).join("")}</select></label>
          <label><span>Assigned agent</span><select name="agent"><option value="">All agents</option>${meta.agents.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
          <label><span>Sort</span><select name="sort"><option value="updated_at">Updated date</option><option value="created_at">Created date</option><option value="title">Title</option><option value="usage_count">Usage count</option></select></label>
          <label><span>Direction</span><select name="direction"><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
          <button type="button" class="ghost" id="clearPromptFilters">Clear</button>
        </form>
        <div class="prompt-results-heading"><h2>Library</h2><span id="promptResultCount">Loading...</span></div>
      </section>
      <section id="promptResults"></section>
      <nav class="prompt-pagination" id="promptPagination" aria-label="Prompt pages"></nav>`;
    const form = document.getElementById("promptFilters");
    form.querySelector('input[name="q"]').addEventListener("input", () => {
      window.clearTimeout(promptState.queryTimer);
      promptState.queryTimer = window.setTimeout(() => { form.dataset.page = "1"; loadPromptList(); }, 250);
    });
    form.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => { form.dataset.page = "1"; loadPromptList(); }));
    document.getElementById("clearPromptFilters").addEventListener("click", () => { form.reset(); form.dataset.page = "1"; loadPromptList(); });
    document.getElementById("runSelectedPrompts")?.addEventListener("click", async () => {
      const ids = Array.from(document.querySelectorAll(".prompt-run-check:checked")).map((cb) => cb.dataset.id);
      if (!ids.length) { toast("Select at least one prompt to run.", "warn"); return; }
      const results = document.getElementById("runResults");
      results.style.display = "block"; results.innerHTML = "<p>Running selected prompts...</p>";
      const outputs = [];
      for (const id of ids) {
        try {
          const res = await api(`/api/prompts/${id}/run`, { method: "POST", body: "{}" });
          outputs.push(`<div><strong>${escapeHtml(res.result.prompt_code)}</strong>: ${escapeHtml(res.result.status)} (agent: ${escapeHtml(res.result.agent_key)}) — preview: ${escapeHtml(res.result.executed_text_preview)}</div>`);
        } catch (e) { outputs.push(`<div><strong>${escapeHtml(id)}</strong>: error — ${escapeHtml(e.message)}</div>`); }
      }
      results.innerHTML = `<h3>Run results</h3>` + outputs.join("");
      toast("Selected prompts executed.");
    });
    await loadPromptList();
  } catch (error) {
    renderError(error, renderLibrary);
  }
}

function formMarkup(prompt = {}) {
  const meta = promptState.meta;
  return `<form id="promptForm" class="prompt-form" novalidate>
    <div class="prompt-field span-2"><label for="promptTitle">Title <span aria-hidden="true">*</span></label><input id="promptTitle" name="title" required maxlength="255" value="${escapeHtml(prompt.title)}"><small class="field-error" data-error="title"></small></div>
    <div class="prompt-field span-2"><label for="promptDescription">Description</label><textarea id="promptDescription" name="description" rows="3">${escapeHtml(prompt.description)}</textarea><small class="field-error" data-error="description"></small></div>
    <div class="prompt-field span-2"><label for="promptText">Prompt text <span aria-hidden="true">*</span></label><textarea id="promptText" name="prompt_text" rows="16" required spellcheck="true">${escapeHtml(prompt.prompt_text)}</textarea><small class="field-error" data-error="prompt_text"></small></div>
    <div class="prompt-field"><label for="promptCategory">Category</label><input id="promptCategory" name="category" maxlength="120" list="promptCategories" value="${escapeHtml(prompt.category)}"><datalist id="promptCategories">${meta.categories.map((item) => `<option value="${escapeHtml(item)}">`).join("")}</datalist><small class="field-error" data-error="category"></small></div>
    <div class="prompt-field"><label for="promptTags">Tags</label><input id="promptTags" name="tags" value="${escapeHtml((prompt.tags || []).join(", "))}" placeholder="Comma-separated tags"><small class="field-error" data-error="tags"></small></div>
    <div class="prompt-field"><label for="promptStatus">Status</label><select id="promptStatus" name="status"><option value="Draft" ${prompt.status !== "Active" ? "selected" : ""}>Draft</option><option value="Active" ${prompt.status === "Active" ? "selected" : ""}>Active</option></select></div>
    <div class="prompt-field"><label for="promptAgent">Assigned agent</label><select id="promptAgent" name="assignee_agent_id"><option value="">Unassigned</option>${meta.agents.map((agent) => `<option value="${escapeHtml(agent.id)}" ${prompt.assignee_agent_id === agent.id ? "selected" : ""}>${escapeHtml(agent.name)}</option>`).join("")}</select></div>
    ${prompt.id ? '<div class="prompt-field span-2"><label for="promptSummary">Change summary</label><input id="promptSummary" name="change_summary" maxlength="500" placeholder="Briefly describe this revision"></div>' : ""}
    <div class="prompt-form-actions span-2">
      ${prompt.id ? '<button type="submit" class="prompt-button">Save Changes</button>' : '<button type="button" class="ghost" id="savePromptDraft">Save Draft</button><button type="submit" class="prompt-button">Create Prompt</button>'}
      <a class="ghost" href="${prompt.id ? `/prompts/${prompt.id}` : "/prompts"}">Cancel</a>
    </div>
  </form>`;
}

function formPayload(form) {
  const values = new FormData(form);
  return {
    title: values.get("title"), description: values.get("description"), prompt_text: values.get("prompt_text"),
    category: values.get("category"), tags: String(values.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean),
    status: values.get("status"), assignee_agent_id: values.get("assignee_agent_id") || null,
    change_summary: values.get("change_summary") || undefined,
  };
}

function showFormErrors(form, error) {
  form.querySelectorAll(".field-error").forEach((element) => { element.textContent = ""; });
  for (const [field, message] of Object.entries(error.fields || {})) {
    const target = form.querySelector(`[data-error="${field}"]`);
    if (target) target.textContent = message;
  }
  toast(error.message, "error");
}

async function renderForm(id = null) {
  loading(id ? "Loading prompt..." : "Preparing editor...");
  try {
    await ensureContext();
    if (!promptState.session.permissions.create) throw new Error("You do not have permission to edit prompts.");
    const prompt = id ? (await api(`/api/prompts/${id}`)).prompt : {};
    if (id && !prompt.permissions.edit) throw new Error("Only the owner or an administrator can edit this prompt.");
    promptApp.innerHTML = pageHeading(id ? prompt.prompt_code : "New prompt", id ? "Edit Prompt" : "Create Prompt", id ? `Editing version ${prompt.version}. Saving important changes creates a new version.` : "Prompt codes and ownership are assigned automatically.") + `<section class="prompt-panel">${formMarkup(prompt)}</section>`;
    const form = document.getElementById("promptForm");
    const submit = async (forceDraft = false) => {
      if (!form.reportValidity()) return;
      const payload = formPayload(form);
      if (forceDraft) payload.status = "Draft";
      form.querySelectorAll("button").forEach((button) => { button.disabled = true; });
      try {
        const result = await api(id ? `/api/prompts/${id}` : "/api/prompts", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
        toast(id ? "Prompt updated." : forceDraft ? "Draft saved." : "Prompt created.");
        window.location.href = `/prompts/${result.prompt.id}`;
      } catch (error) {
        showFormErrors(form, error);
        form.querySelectorAll("button").forEach((button) => { button.disabled = false; });
      }
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); submit(false); });
    document.getElementById("savePromptDraft")?.addEventListener("click", () => submit(true));
  } catch (error) {
    renderError(error, () => renderForm(id));
  }
}

async function renderDetails(id) {
  loading("Loading prompt details...");
  try {
    const prompt = (await api(`/api/prompts/${id}`)).prompt;
    promptApp.innerHTML = pageHeading(prompt.prompt_code, prompt.title, prompt.description || "No description", `<a class="ghost" href="/prompts/${id}/versions">Version history</a>`) + `
      <section class="prompt-detail-grid">
        <article class="prompt-panel prompt-content-panel">
          <div class="prompt-panel-heading"><div><span class="prompt-label">Prompt text</span><h2>Version ${prompt.version}</h2></div><button type="button" class="prompt-button" data-prompt-action="copy" data-id="${prompt.id}">Copy</button></div>
          <pre class="prompt-content" id="promptContent" tabindex="0">${escapeHtml(prompt.prompt_text)}</pre>
        </article>
        <aside class="prompt-panel prompt-facts"><div class="prompt-panel-heading"><h2>Details</h2>${statusBadge(prompt.status)}</div>
          <dl><div><dt>Category</dt><dd>${escapeHtml(prompt.category || "Uncategorized")}</dd></div><div><dt>Tags</dt><dd>${tagList(prompt.tags)}</dd></div><div><dt>Owner</dt><dd>${escapeHtml(prompt.owner_name)}</dd></div><div><dt>Assigned agent</dt><dd>${escapeHtml(prompt.assignee_agent_name || "Unassigned")}</dd></div><div><dt>Usage count</dt><dd>${prompt.usage_count}</dd></div><div><dt>Created</dt><dd>${escapeHtml(formatDate(prompt.created_at))}</dd></div><div><dt>Updated</dt><dd>${escapeHtml(formatDate(prompt.updated_at))}</dd></div></dl>
          ${actionButtons(prompt)}
        </aside>
      </section>`;
    bindPromptActions(async (action) => { if (action === "delete") window.location.href = "/prompts"; else await renderDetails(id); });
    document.querySelector("[data-prompt-action='run']")?.addEventListener("click", async () => {
      const panel = document.getElementById("runResultPanel");
      panel.style.display = "block"; panel.innerHTML = "<p>Executing prompt...</p>";
      try {
        const res = await api(`/api/prompts/${id}/run`, { method: "POST", body: "{}" });
        panel.innerHTML = `<h3>Execution result</h3><dl><div><dt>Agent</dt><dd>${escapeHtml(res.result.agent_key)}</dd></div><div><dt>Code</dt><dd>${escapeHtml(res.result.prompt_code)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(res.result.status)}</dd></div><div><dt>Preview</dt><dd><pre style="white-space:pre-wrap">${escapeHtml(res.result.executed_text_preview)}</pre></dd></div></dl><p><em>Full agent reply requires the agent runtime; this endpoint validates guardrails, updates usage/audit, and returns execution status.</em></p>`;
      } catch (e) { panel.innerHTML = `<p style="color:#a63240">Failed: ${escapeHtml(e.message)}</p>`; }
    });
  } catch (error) {
    renderError(error, () => renderDetails(id));
  }
}

async function renderVersions(id) {
  loading("Loading version history...");
  try {
    const [promptData, versionData] = await Promise.all([api(`/api/prompts/${id}`), api(`/api/prompts/${id}/versions`)]);
    const prompt = promptData.prompt;
    const versions = versionData.versions;
    promptApp.innerHTML = pageHeading(prompt.prompt_code, "Version History", prompt.title, `<a class="ghost" href="/prompts/${id}">Prompt details</a>`) + `
      <section class="prompt-panel prompt-compare-controls"><h2>Compare versions</h2><div><label>From<select id="compareFrom">${versions.map((item, index) => `<option value="${item.version}" ${index === Math.min(1, versions.length - 1) ? "selected" : ""}>Version ${item.version}</option>`).join("")}</select></label><label>To<select id="compareTo">${versions.map((item, index) => `<option value="${item.version}" ${index === 0 ? "selected" : ""}>Version ${item.version}</option>`).join("")}</select></label><button type="button" id="compareVersions">Compare</button></div><div id="versionComparison"></div></section>
      <section class="prompt-version-list">${versions.map((item) => `<article class="prompt-panel prompt-version-item"><div><div class="prompt-card-top"><code>Version ${item.version}</code>${statusBadge(item.status)}</div><h2>${escapeHtml(item.change_summary)}</h2><p>Changed by ${escapeHtml(item.changed_by_name)} on ${escapeHtml(formatDate(item.created_at))}</p></div><div class="prompt-actions"><button type="button" class="ghost" data-view-version="${item.version}">View</button>${prompt.permissions.edit && item.version !== prompt.version ? `<button type="button" class="ghost" data-restore-version="${item.version}">Restore</button>` : ""}</div><pre class="prompt-version-content" id="version-${item.version}" hidden>${escapeHtml(item.prompt_text)}</pre></article>`).join("")}</section>`;
    document.querySelectorAll("[data-view-version]").forEach((button) => button.addEventListener("click", () => {
      const content = document.getElementById(`version-${button.dataset.viewVersion}`);
      content.hidden = !content.hidden;
      button.textContent = content.hidden ? "View" : "Hide";
    }));
    document.querySelectorAll("[data-restore-version]").forEach((button) => button.addEventListener("click", async () => {
      const version = button.dataset.restoreVersion;
      if (!window.confirm(`Restore version ${version}? A new version will be created.`)) return;
      try {
        const result = await api(`/api/prompts/${id}/versions/${version}/restore`, { method: "POST", body: "{}" });
        toast(`Version ${version} restored as version ${result.prompt.version}.`);
        await renderVersions(id);
      } catch (error) { toast(error.message, "error"); }
    }));
    document.getElementById("compareVersions").addEventListener("click", async () => {
      const from = document.getElementById("compareFrom").value;
      const to = document.getElementById("compareTo").value;
      try {
        const comparison = await api(`/api/prompts/${id}/versions/compare?from=${from}&to=${to}`);
        document.getElementById("versionComparison").innerHTML = `<div class="prompt-changed-fields">${comparison.changed_fields.length ? comparison.changed_fields.map((field) => `<span>${escapeHtml(field.replaceAll("_", " "))}</span>`).join("") : "No important fields changed"}</div><div class="prompt-compare-grid"><div><h3>Version ${from}</h3><pre>${escapeHtml(comparison.from.prompt_text)}</pre></div><div><h3>Version ${to}</h3><pre>${escapeHtml(comparison.to.prompt_text)}</pre></div></div>`;
      } catch (error) { toast(error.message, "error"); }
    });
  } catch (error) {
    renderError(error, () => renderVersions(id));
  }
}

async function routePromptPage() {
  const parts = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts[0] !== "prompts" || parts.length === 1 || parts[0] === "prompts.html") return renderLibrary();
  if (parts[1] === "new") return renderForm();
  const id = parts[1];
  if (parts[2] === "edit") return renderForm(id);
  if (parts[2] === "versions") return renderVersions(id);
  return renderDetails(id);
}

routePromptPage();