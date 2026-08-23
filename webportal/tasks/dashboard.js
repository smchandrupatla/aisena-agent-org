// Tasks & Issues Executive Dashboard
// Data-driven KPIs, drill-down navigation, hover previews, and report generation.

const API_BASE = window.API_BASE_OVERRIDE || '';

const TASK_STATUSES = ["Backlog", "Planned", "In Progress", "Blocked", "In Review", "Done"];
const ISSUE_STATUSES = ["Open", "Triaged", "Mitigating", "Monitoring", "Verifying", "Resolved"];

const HISTORY_LOG_KEY = 'aisena_dashboard_history_log';

const STATUS_COLORS = {
  "Backlog": "#94a3b8",
  "Planned": "#00a7f5",
  "In Progress": "#2363eb",
  "Blocked": "#d24b57",
  "In Review": "#f5b544",
  "Done": "#1f9d68",
  "Open": "#d24b57",
  "Triaged": "#f5b544",
  "Mitigating": "#7c5cff",
  "Monitoring": "#00a7f5",
  "Verifying": "#2363eb",
  "Resolved": "#1f9d68",
};

const SEVERITY_COLORS = { "Low": "#1f9d68", "Medium": "#f5b544", "High": "#d24b57", "Critical": "#5b3df0" };
const PRIORITY_COLORS = { "Low": "#1f9d68", "Medium": "#f5b544", "High": "#d24b57", "Critical": "#5b3df0" };

let tasksData = [];
let issuesData = [];
let agentsData = [];
let lastLoadedAt = null;

// ---------------------------------------------------------------------------
// History Log: append-only record of orchestration and UI actions.
// Each entry: { timestamp: ISO-8601 UTC, actor, action, details }
// ---------------------------------------------------------------------------
function readHistoryLog() {
  try {
    const raw = localStorage.getItem(HISTORY_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeHistoryLog(entries) {
  try {
    localStorage.setItem(HISTORY_LOG_KEY, JSON.stringify(entries));
  } catch (e) {
    // Ignore storage errors (e.g. private mode)
  }
}

function logHistoryAction(action, details, actor = 'dashboard') {
  const entries = readHistoryLog();
  entries.push({
    timestamp: new Date().toISOString(),
    actor,
    action,
    details: details || '',
  });
  writeHistoryLog(entries);
}

function aggregateActivityHistory() {
  const entries = [];
  tasksData.forEach(task => {
    (task.activity_log || []).forEach(entry => {
      entries.push({
        timestamp: entry.timestamp || task.updated_at,
        actor: entry.actor || task.owner || 'system',
        action: entry.action || 'activity',
        details: `[${task.id}] ${entry.details || ''}`,
      });
    });
  });
  issuesData.forEach(issue => {
    (issue.activity_log || []).forEach(entry => {
      entries.push({
        timestamp: entry.timestamp || issue.updated_at,
        actor: entry.actor || issue.owner || 'system',
        action: entry.action || 'activity',
        details: `[${issue.id}] ${entry.details || ''}`,
      });
    });
  });
  return entries;
}

function getFullHistoryLog() {
  return [...aggregateActivityHistory(), ...readHistoryLog()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// ---------------------------------------------------------------------------
// Background agent runner UI
// Provides a manual "kick off" button and polls a status endpoint.
// ---------------------------------------------------------------------------
const agentRunner = {
  current: null,
  runningTaskId: null,
  runningIssueId: null,
  pollingId: null,

  getStatusEl(scope) { return document.getElementById(`${scope}-agent-status`); },
  getOutputEl(scope) { return document.getElementById(`${scope}-agent-output`); },
  getRunBtn(scope) { return document.getElementById(`${scope}-run-agent-btn`); },

  setStatus(scope, text, color = '#5b3df0', bg = '#eef2ff') {
    const el = this.getStatusEl(scope);
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
    el.style.background = bg;
  },

  appendOutput(scope, line) {
    const out = this.getOutputEl(scope);
    if (!out) return;
    out.style.display = 'block';
    out.textContent += `[${new Date().toISOString()}] ${line}\n`;
    out.scrollTop = out.scrollHeight;
  },

  clearOutput(scope) {
    const out = this.getOutputEl(scope);
    if (!out) return;
    out.textContent = '';
    out.style.display = 'none';
  },

  async start(scope) {
    if (this.current) {
      showToast(`Agent already running (${this.current}). Cancel first or wait.`, 'info');
      return;
    }
    this.current = scope;
    this.clearOutput(scope);
    this.setStatus(scope, 'Starting…', '#d97706', '#fff7ed');
    this.getRunBtn(scope).disabled = true;
    this.appendOutput(scope, `Manual start requested for ${scope} agent.`);
    logHistoryAction('agent_started', `User started the ${scope} agent from the portal.`, 'user');

    try {
      const resp = await fetch(`${API_BASE}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.appendOutput(scope, `Agent accepted job: ${data.job_id || 'unknown'}`);
      this.setStatus(scope, 'Running', '#1f9d68', '#ecfdf5');
      this.startPolling(scope);
    } catch (err) {
      this.appendOutput(scope, `Failed to start agent: ${err.message || err}`);
      this.setStatus(scope, 'Failed to start', '#d24b57', '#fef2f2');
      this.getRunBtn(scope).disabled = false;
      this.current = null;
      logHistoryAction('agent_start_failed', `User attempt to start ${scope} agent failed: ${err.message || err}.`, 'user');
    }
  },

  async runTask(taskId) {
    if (this.current) {
      showToast(`Agent already running. Cancel first or wait.`, 'info');
      return;
    }
    const task = tasksData.find(t => t.id === taskId);
    if (!task || task.status === 'Done') {
      showToast(`Cannot run agent for completed task ${taskId}.`, 'info');
      return;
    }
    this.current = 'tasks';
    this.runningTaskId = taskId;
    this.clearOutput('tasks');
    this.setStatus('tasks', 'Starting…', '#d97706', '#fff7ed');
    this.appendOutput('tasks', `Manual start requested for task ${taskId}.`);
    logHistoryAction('agent_started', `User started the implementation agent for task ${taskId}.`, 'user');

    try {
      const resp = await fetch(`${API_BASE}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'tasks', task_id: taskId }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.appendOutput('tasks', `Agent accepted job: ${data.job_id || 'unknown'}`);
      this.setStatus('tasks', 'Running', '#1f9d68', '#ecfdf5');
      this.startPolling('tasks');
    } catch (err) {
      this.appendOutput('tasks', `Failed to start agent: ${err.message || err}`);
      this.setStatus('tasks', 'Failed to start', '#d24b57', '#fef2f2');
      this.current = null;
      this.runningTaskId = null;
      logHistoryAction('agent_start_failed', `User attempt to start agent for task ${taskId} failed: ${err.message || err}.`, 'user');
    }
  },

  async runIssue(issueId) {
    if (this.current) {
      showToast(`Agent already running. Cancel first or wait.`, 'info');
      return;
    }
    const issue = issuesData.find(i => i.id === issueId);
    if (!issue || issue.status === 'Resolved') {
      showToast(`Cannot run agent for resolved issue ${issueId}.`, 'info');
      return;
    }
    this.current = 'issues';
    this.runningIssueId = issueId;
    this.clearOutput('issues');
    this.setStatus('issues', 'Starting…', '#d97706', '#fff7ed');
    this.appendOutput('issues', `Manual start requested for issue ${issueId}.`);
    logHistoryAction('agent_started', `User started the remediation agent for issue ${issueId}.`, 'user');

    try {
      const resp = await fetch(`${API_BASE}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'issues', issue_id: issueId }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.appendOutput('issues', `Agent accepted job: ${data.job_id || 'unknown'}`);
      this.setStatus('issues', 'Running', '#1f9d68', '#ecfdf5');
      this.startPolling('issues');
    } catch (err) {
      this.appendOutput('issues', `Failed to start agent: ${err.message || err}`);
      this.setStatus('issues', 'Failed to start', '#d24b57', '#fef2f2');
      this.current = null;
      this.runningIssueId = null;
      logHistoryAction('agent_start_failed', `User attempt to start agent for issue ${issueId} failed: ${err.message || err}.`, 'user');
    }
  },

  async cancel() {
    if (!this.current) {
      showToast('No agent is currently running.', 'info');
      return;
    }
    const scope = this.current;
    const taskId = this.runningTaskId;
    const issueId = this.runningIssueId;
    this.appendOutput(scope, 'Cancel requested by user.');
    try {
      const resp = await fetch(`${API_BASE}/api/agent/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, task_id: taskId, issue_id: issueId }) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.appendOutput(scope, 'Cancel signal sent.');
      this.setStatus(scope, 'Cancelling…', '#d97706', '#fff7ed');
      logHistoryAction('agent_cancelled', `User cancelled the running ${scope} agent${taskId ? ` for task ${taskId}` : ''}${issueId ? ` for issue ${issueId}` : ''}.`, 'user');
    } catch (err) {
      this.appendOutput(scope, `Cancel failed: ${err.message || err}`);
    }
  },

  startPolling(scope) {
    if (this.pollingId) clearInterval(this.pollingId);
    this.pollingId = setInterval(() => this.poll(scope), 3000);
  },

  async poll(scope) {
    try {
      const data = await fetchJson(`/api/agent/status?scope=${encodeURIComponent(scope)}`);
      if (!data) return;
      const statusText = data.status || 'Running';
      const isTerminal = ['completed', 'failed', 'cancelled', 'idle'].includes(statusText.toLowerCase());
      this.setStatus(scope, statusText, isTerminal ? '#5b3df0' : '#1f9d68', isTerminal ? '#eef2ff' : '#ecfdf5');
      if (data.updates && data.updates.length) {
        data.updates.forEach(u => this.appendOutput(scope, `${u.actor || 'agent'}: ${u.action}${u.details ? ` — ${u.details}` : ''}`));
      }
      if (isTerminal) {
        clearInterval(this.pollingId);
        this.pollingId = null;
        this.getRunBtn(scope).disabled = false;
        this.current = null;
        this.runningTaskId = null;
        this.runningIssueId = null;
        this.appendOutput(scope, `Agent finished with status: ${statusText}`);
        logHistoryAction('agent_finished', `${scope} agent finished with status ${statusText}.`, 'agent');
        loadDashboardData(true);
      }
    } catch (err) {
      // ignore polling errors
    }
  },
};

// ---------------------------------------------------------------------------
// Navigation: a simple stack so any drill-down can be "backed" out of, and
// clicking a sidebar item resets to that top-level page.
// ---------------------------------------------------------------------------
const dashNav = {
  stack: [{ page: 'overview', label: 'Overview' }],
  current() { return this.stack[this.stack.length - 1]; },
  go(page, opts = {}) {
    const entry = { page, label: opts.label || page, ...opts };
    this.stack.push(entry);
    this.render();
  },
  replaceTop(page, opts = {}) {
    this.stack[this.stack.length - 1] = { page, label: opts.label || page, ...opts };
    this.render();
  },
  goRoot(page, label) {
    this.stack = [{ page, label }];
    this.render();
  },
  back() {
    if (this.stack.length > 1) this.stack.pop();
    this.render();
  },
  jumpTo(index) {
    this.stack = this.stack.slice(0, index + 1);
    this.render();
  },
  render() {
    const entry = this.current();
    document.querySelectorAll('.xd-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(`view-${entry.page}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.xd-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === (this.stack[0] && this.stack[0].page));
    });

    document.getElementById('xd-back-btn').classList.toggle('visible', this.stack.length > 1);
    renderBreadcrumb();
    dispatchRender(entry);
  }
};

function renderBreadcrumb() {
  const el = document.getElementById('xd-breadcrumb');
  el.innerHTML = '';
  dashNav.stack.forEach((entry, idx) => {
    if (idx > 0) el.appendChild(document.createTextNode(' / '));
    const span = document.createElement('span');
    span.className = 'xd-crumb';
    span.textContent = idx === 0 ? 'Dashboard' : entry.label;
    if (idx < dashNav.stack.length - 1) {
      span.addEventListener('click', () => dashNav.jumpTo(idx));
    } else {
      span.style.cursor = 'default';
      const b = document.createElement('b');
      b.textContent = span.textContent;
      el.appendChild(b);
      return;
    }
    el.appendChild(span);
  });
}

function dispatchRender(entry) {
  switch (entry.page) {
    case 'overview': renderOverview(); break;
    case 'tasks': renderTasksPage(entry.filter, entry.filterLabel); break;
    case 'issues': renderIssuesPage(entry.filter, entry.filterLabel); break;
    case 'task-detail': renderTaskDetail(entry.id); break;
    case 'issue-detail': renderIssueDetail(entry.id); break;
    case 'team': renderTeamPage(); break;
    case 'team-detail': renderTeamDetail(entry.owner); break;
    case 'analytics': renderAnalyticsPage(); break;
    case 'reports': reportsUI.render(); break;
    case 'history': renderHistoryPage(); break;
  }
  if (entry.page !== 'history') {
    logHistoryAction('viewed', `Rendered ${entry.page} page${entry.id ? ` (${entry.id})` : ''}.`, 'dashboard');
  }
  // Reset agent runner UI on page switch to avoid stale "Running" labels.
  if (entry.page === 'tasks' || entry.page === 'issues') {
    agentRunner.setStatus(entry.page, agentRunner.current === entry.page ? 'Running' : 'Idle');
  }
}

document.getElementById('xd-primary-nav').addEventListener('click', (e) => {
  const item = e.target.closest('.xd-nav-item');
  if (!item) return;
  const page = item.dataset.page;
  logHistoryAction('navigated', `User navigated to ${page} page.`, 'user');
  dashNav.goRoot(page, item.textContent.trim());
});

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------
async function fetchJson(path) {
  try {
    const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

async function loadDashboardData(isRefresh) {
  showLoading(true);
  try {
    const [tasksResp, issuesResp, agentsResp] = await Promise.all([
      fetchJson('/api/tasks'),
      fetchJson('/api/issues'),
      fetchJson('/api/agents'),
    ]);
    tasksData = (tasksResp && Array.isArray(tasksResp.tasks)) ? tasksResp.tasks : [];
    issuesData = Array.isArray(issuesResp) ? issuesResp : (issuesResp && Array.isArray(issuesResp.issues) ? issuesResp.issues : []);
    agentsData = (agentsResp && Array.isArray(agentsResp.agents)) ? agentsResp.agents : [];
    lastLoadedAt = new Date();
    document.getElementById('nav-count-tasks').textContent = tasksData.length;
    document.getElementById('nav-count-issues').textContent = issuesData.length;
    updateSidebarProgress();
    dashNav.render();
    logHistoryAction(isRefresh ? 'refreshed' : 'loaded', `Dashboard data ${isRefresh ? 'refreshed' : 'loaded'}: ${tasksData.length} tasks, ${issuesData.length} issues.`, 'dashboard');
    if (isRefresh) showToast('Dashboard refreshed', 'success');
  } catch (err) {
    logHistoryAction('load_failed', `Failed to load dashboard data: ${err.message || err}.`, 'dashboard');
    showToast('Failed to load dashboard data', 'error');
  } finally {
    showLoading(false);
  }
}

function updateSidebarProgress() {
  const total = tasksData.length;
  const done = tasksData.filter(t => t.status === 'Done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('sidebar-progress-value').textContent = `${pct}%`;
  document.getElementById('sidebar-progress-fill').style.width = `${pct}%`;
  document.getElementById('sidebar-progress-caption').textContent = `${done} of ${total} tasks done`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d)) return 'N/A';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d)) return 'N/A';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function initials(name) {
  if (!name) return '?';
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
function badge(text, color) {
  const span = document.createElement('span');
  span.className = 'xd-badge';
  span.style.background = color;
  span.textContent = text;
  return span;
}
function badgeHtml(text, color) {
  return `<span class="xd-badge" style="background:${color}">${text}</span>`;
}
function ownerCellHtml(owner) {
  const name = owner || 'Unassigned';
  return `<span class="xd-owner-cell"><span class="xd-avatar">${initials(name)}</span>${name}</span>`;
}
function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

// ---------------------------------------------------------------------------
// Tooltip (hover preview)
// ---------------------------------------------------------------------------
const tooltip = document.getElementById('xd-tooltip');
function showTooltip(evt, titleText, items) {
  let html = `<div class="xd-tt-title">${titleText}</div>`;
  (items || []).slice(0, 4).forEach(t => { html += `<div class="xd-tt-item">• ${t}</div>`; });
  if (items && items.length > 4) html += `<div class="xd-tt-item">+${items.length - 4} more…</div>`;
  tooltip.innerHTML = html;
  tooltip.classList.add('visible');
  moveTooltip(evt);
}
function moveTooltip(evt) {
  const pad = 16;
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  if (x + 260 > window.innerWidth) x = evt.clientX - 260 - pad;
  if (y + 120 > window.innerHeight) y = evt.clientY - 120 - pad;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}
function hideTooltip() { tooltip.classList.remove('visible'); }

// ---------------------------------------------------------------------------
// Donut chart builder (SVG, per-segment click + hover)
// ---------------------------------------------------------------------------
function renderDonut(container, legendContainer, segments, opts = {}) {
  container.innerHTML = '';
  legendContainer.innerHTML = '';
  const size = opts.size || 168;
  const thickness = opts.thickness || 20;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  const track = document.createElementNS(svgNS, 'circle');
  track.setAttribute('cx', size / 2);
  track.setAttribute('cy', size / 2);
  track.setAttribute('r', radius);
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'var(--bg-soft)');
  track.setAttribute('stroke-width', thickness);
  svg.appendChild(track);

  let cumulative = 0;

  segments.forEach(seg => {
    if (seg.value <= 0 || total === 0) return;
    const frac = seg.value / total;
    const dash = frac * circumference;
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', size / 2);
    circle.setAttribute('cy', size / 2);
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', seg.color);
    circle.setAttribute('stroke-width', thickness);
    circle.setAttribute('stroke-dasharray', `${dash} ${circumference - dash}`);
    circle.setAttribute('stroke-dashoffset', `${-cumulative}`);
    circle.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
    circle.style.cursor = 'pointer';
    circle.style.transition = 'stroke-width .15s ease';
    circle.addEventListener('mouseenter', (evt) => {
      circle.setAttribute('stroke-width', thickness + 4);
      showTooltip(evt, `${seg.label} · ${seg.value} (${Math.round(frac * 100)}%)`, seg.previewItems);
    });
    circle.addEventListener('mousemove', moveTooltip);
    circle.addEventListener('mouseleave', () => {
      circle.setAttribute('stroke-width', thickness);
      hideTooltip();
    });
    circle.addEventListener('click', () => { if (opts.onSegmentClick) opts.onSegmentClick(seg); });
    svg.appendChild(circle);
    cumulative += dash;
  });

  const centerLabel = document.createElement('div');
  centerLabel.style.cssText = `position:relative;width:${size}px;height:${size}px;`;
  const centerText = document.createElement('div');
  centerText.className = 'xd-donut-center';
  centerText.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;`;
  centerText.innerHTML = `${total}<small>${opts.centerLabel || 'Total'}</small>`;
  centerLabel.appendChild(svg);
  centerLabel.appendChild(centerText);
  container.appendChild(centerLabel);

  segments.forEach(seg => {
    const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
    const row = el('div', 'xd-legend-row');
    row.innerHTML = `<span class="xd-legend-dot" style="background:${seg.color}"></span><span class="xd-legend-label">${seg.label}</span><span class="xd-legend-value">${seg.value}</span><span class="xd-legend-pct">${pct}%</span>`;
    row.addEventListener('mouseenter', (evt) => showTooltip(evt, `${seg.label} · ${seg.value} (${pct}%)`, seg.previewItems));
    row.addEventListener('mousemove', moveTooltip);
    row.addEventListener('mouseleave', hideTooltip);
    row.addEventListener('click', () => { if (opts.onSegmentClick) opts.onSegmentClick(seg); });
    legendContainer.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Sparkline (SVG polyline)
// ---------------------------------------------------------------------------
function buildSparkline(values, color, width = 90, height = 30) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`).join(' ');
  const poly = document.createElementNS(svgNS, 'polyline');
  poly.setAttribute('points', points);
  poly.setAttribute('fill', 'none');
  poly.setAttribute('stroke', color);
  poly.setAttribute('stroke-width', '2');
  poly.setAttribute('stroke-linecap', 'round');
  poly.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(poly);
  return svg;
}

function dailyBuckets(items, days = 14) {
  const buckets = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    const count = items.filter(it => (it.created_at || '').slice(0, 10) === key).length;
    buckets.push({ key, count });
  }
  return buckets;
}
function trendDirection(buckets) {
  const half = Math.floor(buckets.length / 2);
  const first = buckets.slice(0, half).reduce((s, b) => s + b.count, 0);
  const second = buckets.slice(half).reduce((s, b) => s + b.count, 0);
  if (second > first) return 'up';
  if (second < first) return 'down';
  return 'flat';
}

// ---------------------------------------------------------------------------
// KPI card builder
// ---------------------------------------------------------------------------
function buildKpiCard({ icon, iconColor, label, value, trend, trendText, sparkValues, sparkColor, onClick }) {
  const card = el('div', 'xd-kpi-card');
  card.innerHTML = `
    <div class="xd-kpi-top">
      <div class="xd-kpi-icon" style="background:${iconColor}">${icon}</div>
    </div>
    <div class="xd-kpi-label">${label}</div>
    <div class="xd-kpi-value">${value}</div>
    <div class="xd-kpi-trend ${trend}">${trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} ${trendText}</div>
  `;
  if (sparkValues) {
    const spark = el('div', 'xd-sparkline');
    spark.appendChild(buildSparkline(sparkValues, sparkColor));
    card.appendChild(spark);
  }
  if (onClick) card.addEventListener('click', onClick);
  return card;
}

// ---------------------------------------------------------------------------
// Progress bar / stacked bar builders
// ---------------------------------------------------------------------------
function buildProgressBar(label, count, total, color) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const wrap = el('div', 'xd-progress-block');
  wrap.innerHTML = `
    <div class="xd-progress-head"><span>${label}</span><b>${count} / ${total} (${pct}%)</b></div>
    <div class="xd-progress-track"><div class="xd-progress-fill" style="width:${pct}%;background:${color}"></div></div>
  `;
  return wrap;
}

function buildStackedBar(segments, onSegmentClick) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const wrap = document.createDocumentFragment();
  const track = el('div', 'xd-stacked-track');
  segments.forEach(seg => {
    if (seg.value <= 0 || total === 0) return;
    const pct = (seg.value / total) * 100;
    const segEl = el('div', 'xd-stacked-seg');
    segEl.style.width = `${pct}%`;
    segEl.style.background = seg.color;
    segEl.addEventListener('mouseenter', (evt) => showTooltip(evt, `${seg.label} · ${seg.value} (${Math.round(pct)}%)`, seg.previewItems));
    segEl.addEventListener('mousemove', moveTooltip);
    segEl.addEventListener('mouseleave', hideTooltip);
    segEl.addEventListener('click', () => onSegmentClick && onSegmentClick(seg));
    track.appendChild(segEl);
  });
  wrap.appendChild(track);
  const legend = el('div', 'xd-stacked-legend');
  segments.forEach(seg => {
    const item = el('span', '', `<i style="background:${seg.color}"></i>${seg.label} (${seg.value})`);
    item.addEventListener('click', () => onSegmentClick && onSegmentClick(seg));
    legend.appendChild(item);
  });
  wrap.appendChild(legend);
  return wrap;
}

// ---------------------------------------------------------------------------
// Overview page
// ---------------------------------------------------------------------------
function renderOverview() {
  document.getElementById('overview-updated').textContent = lastLoadedAt ? `Updated ${formatDateTime(lastLoadedAt.toISOString())}` : '';

  const totalTasks = tasksData.length;
  const doneTasks = tasksData.filter(t => t.status === 'Done').length;
  const inProgressTasks = tasksData.filter(t => t.status === 'In Progress').length;
  const blockedTasks = tasksData.filter(t => t.status === 'Blocked').length;
  const totalIssues = issuesData.length;
  const openIssues = issuesData.filter(i => i.status !== 'Resolved').length;
  const escalations = issuesData.filter(i => i.escalation_flag).length;

  const taskBuckets = dailyBuckets(tasksData);
  const issueBuckets = dailyBuckets(issuesData);

  const kpiGrid = document.getElementById('overview-kpis');
  kpiGrid.innerHTML = '';
  kpiGrid.appendChild(buildKpiCard({
    icon: '📋', iconColor: 'linear-gradient(135deg,#2363eb,#00a7f5)', label: 'Total tasks', value: totalTasks,
    trend: trendDirection(taskBuckets), trendText: `${taskBuckets.slice(7).reduce((s, b) => s + b.count, 0)} created this week`,
    sparkValues: taskBuckets.map(b => b.count), sparkColor: '#2363eb',
    onClick: () => dashNav.go('tasks', { label: 'All tasks' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '✅', iconColor: 'linear-gradient(135deg,#1f9d68,#14b8a6)', label: 'Completed', value: doneTasks,
    trend: doneTasks > 0 ? 'up' : 'flat', trendText: `${totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}% completion rate`,
    onClick: () => dashNav.go('tasks', { label: 'Done', filter: t => t.status === 'Done', filterLabel: 'Done' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '⏳', iconColor: 'linear-gradient(135deg,#7c5cff,#5b3df0)', label: 'In progress', value: inProgressTasks,
    trend: 'flat', trendText: 'Active right now',
    onClick: () => dashNav.go('tasks', { label: 'In Progress', filter: t => t.status === 'In Progress', filterLabel: 'In Progress' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '🚧', iconColor: 'linear-gradient(135deg,#d24b57,#f5b544)', label: 'Blocked', value: blockedTasks,
    trend: blockedTasks > 0 ? 'down' : 'flat', trendText: blockedTasks > 0 ? 'Needs attention' : 'None blocked',
    onClick: () => dashNav.go('tasks', { label: 'Blocked', filter: t => t.status === 'Blocked', filterLabel: 'Blocked' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '⚠️', iconColor: 'linear-gradient(135deg,#f5b544,#d24b57)', label: 'Open issues', value: openIssues,
    trend: trendDirection(issueBuckets), trendText: `${issueBuckets.slice(7).reduce((s, b) => s + b.count, 0)} reported this week`,
    sparkValues: issueBuckets.map(b => b.count), sparkColor: '#d24b57',
    onClick: () => dashNav.go('issues', { label: 'Open issues', filter: i => i.status !== 'Resolved', filterLabel: 'Open' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '🚨', iconColor: 'linear-gradient(135deg,#5b3df0,#d24b57)', label: 'Escalations', value: escalations,
    trend: escalations > 0 ? 'down' : 'flat', trendText: escalations > 0 ? 'Requires executive review' : 'No escalations',
    onClick: () => dashNav.go('issues', { label: 'Escalations', filter: i => i.escalation_flag, filterLabel: 'Escalations' }),
  }));

  // Task status donut
  const statusSegments = TASK_STATUSES.map(status => ({
    label: status, value: tasksData.filter(t => t.status === status).length, color: STATUS_COLORS[status],
    previewItems: tasksData.filter(t => t.status === status).slice(0, 4).map(t => `${t.id}: ${t.title}`),
  }));
  renderDonut(document.getElementById('task-donut-svg'), document.getElementById('task-donut-legend'), statusSegments, {
    centerLabel: 'Tasks',
    onSegmentClick: (seg) => dashNav.go('tasks', { label: seg.label, filter: t => t.status === seg.label, filterLabel: seg.label }),
  });

  // Issue severity donut
  const severitySegments = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({
    label: sev, value: issuesData.filter(i => i.severity === sev).length, color: SEVERITY_COLORS[sev],
    previewItems: issuesData.filter(i => i.severity === sev).slice(0, 4).map(i => `${i.id}: ${i.title}`),
  }));
  renderDonut(document.getElementById('issue-donut-svg'), document.getElementById('issue-donut-legend'), severitySegments, {
    centerLabel: 'Issues',
    onSegmentClick: (seg) => dashNav.go('issues', { label: seg.label, filter: i => i.severity === seg.label, filterLabel: `${seg.label} severity` }),
  });

  // Progress bars
  const progressWrap = document.getElementById('overview-progress-bars');
  progressWrap.innerHTML = '';
  progressWrap.appendChild(buildProgressBar('Task completion (Done)', doneTasks, totalTasks, '#1f9d68'));
  progressWrap.appendChild(buildProgressBar('Issue resolution (Resolved)', issuesData.filter(i => i.status === 'Resolved').length, totalIssues, '#2363eb'));

  // Recent tasks / issues tables
  const recentTasks = [...tasksData].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)).slice(0, 6);
  const overviewTasksBody = document.getElementById('overview-tasks-body');
  overviewTasksBody.innerHTML = '';
  if (!recentTasks.length) overviewTasksBody.innerHTML = `<tr><td colspan="4" class="xd-empty">No tasks yet.</td></tr>`;
  recentTasks.forEach(task => {
    const tr = el('tr', '', `<td><strong>${task.title}</strong><br><small style="color:var(--ink-soft)">${task.id}</small></td><td>${badgeHtml(task.status, STATUS_COLORS[task.status] || '#94a3b8')}</td><td>${badgeHtml(task.priority || 'Medium', PRIORITY_COLORS[task.priority] || '#2363eb')}</td><td>${ownerCellHtml(task.owner)}</td>`);
    tr.addEventListener('mouseenter', (evt) => showTooltip(evt, task.title, [task.description || 'No description', `Next: ${task.next_checkpoint || 'n/a'}`]));
    tr.addEventListener('mousemove', moveTooltip);
    tr.addEventListener('mouseleave', hideTooltip);
    tr.addEventListener('click', () => dashNav.go('task-detail', { label: task.id, id: task.id }));
    overviewTasksBody.appendChild(tr);
  });

  const recentIssues = [...issuesData].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)).slice(0, 6);
  const overviewIssuesBody = document.getElementById('overview-issues-body');
  overviewIssuesBody.innerHTML = '';
  if (!recentIssues.length) overviewIssuesBody.innerHTML = `<tr><td colspan="4" class="xd-empty">No issues yet.</td></tr>`;
  recentIssues.forEach(issue => {
    const tr = el('tr', '', `<td><strong>${issue.title}</strong><br><small style="color:var(--ink-soft)">${issue.id}</small></td><td>${badgeHtml(issue.severity, SEVERITY_COLORS[issue.severity] || '#94a3b8')}</td><td>${badgeHtml(issue.status, STATUS_COLORS[issue.status] || '#94a3b8')}</td><td>${ownerCellHtml(issue.owner)}</td>`);
    tr.addEventListener('mouseenter', (evt) => showTooltip(evt, issue.title, [issue.description || 'No description', `Mitigation: ${issue.mitigation || 'n/a'}`]));
    tr.addEventListener('mousemove', moveTooltip);
    tr.addEventListener('mouseleave', hideTooltip);
    tr.addEventListener('click', () => dashNav.go('issue-detail', { label: issue.id, id: issue.id }));
    overviewIssuesBody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Tasks list page (also used for drill-down filtered lists)
// ---------------------------------------------------------------------------
function renderTasksPage(filterFn, filterLabel) {
  const list = filterFn ? tasksData.filter(filterFn) : tasksData;
  document.getElementById('tasks-page-title').textContent = filterLabel ? `Tasks — ${filterLabel}` : 'Tasks';
  document.getElementById('tasks-page-sub').textContent = filterLabel ? `Showing ${list.length} task(s) filtered by ${filterLabel}.` : `Full list of ${list.length} tracked delivery tasks.`;

  const total = list.length;
  const done = list.filter(t => t.status === 'Done').length;
  const inProgress = list.filter(t => t.status === 'In Progress').length;
  const blocked = list.filter(t => t.status === 'Blocked').length;
  const kpis = document.getElementById('tasks-kpis');
  kpis.innerHTML = '';
  kpis.appendChild(buildKpiCard({ icon: '📋', iconColor: 'linear-gradient(135deg,#2363eb,#00a7f5)', label: 'Total', value: total, trend: 'flat', trendText: 'in this view' }));
  kpis.appendChild(buildKpiCard({ icon: '✅', iconColor: 'linear-gradient(135deg,#1f9d68,#14b8a6)', label: 'Done', value: done, trend: 'flat', trendText: `${total > 0 ? Math.round(done / total * 100) : 0}%` }));
  kpis.appendChild(buildKpiCard({ icon: '⏳', iconColor: 'linear-gradient(135deg,#7c5cff,#5b3df0)', label: 'In progress', value: inProgress, trend: 'flat', trendText: 'active' }));
  kpis.appendChild(buildKpiCard({ icon: '🚧', iconColor: 'linear-gradient(135deg,#d24b57,#f5b544)', label: 'Blocked', value: blocked, trend: 'flat', trendText: 'blocked' }));

  const stackedSegments = TASK_STATUSES.map(status => ({
    label: status, value: list.filter(t => t.status === status).length, color: STATUS_COLORS[status],
    previewItems: list.filter(t => t.status === status).slice(0, 4).map(t => `${t.id}: ${t.title}`),
  }));
  const stackedBarWrap = document.getElementById('tasks-stacked-bar');
  stackedBarWrap.innerHTML = '';
  stackedBarWrap.appendChild(buildStackedBar(stackedSegments, (seg) => dashNav.go('tasks', { label: seg.label, filter: t => t.status === seg.label, filterLabel: seg.label })));

  const body = document.getElementById('tasks-body');
  body.innerHTML = '';
  if (!list.length) { body.innerHTML = `<tr><td colspan="6" class="xd-empty">No tasks match this filter.</td></tr>`; return; }
  [...list].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)).forEach(task => {
    const isDone = task.status === 'Done';
    const isRunning = agentRunner.current === 'tasks' && agentRunner.runningTaskId === task.id;
    const btnLabel = isRunning ? '⏹ Cancel' : (isDone ? '✅ Done' : '▶ Run');
    const btnDisabled = isDone || isRunning;
    const tr = el('tr', '', `<td>${task.id}</td><td><strong>${task.title}</strong></td><td>${badgeHtml(task.status, STATUS_COLORS[task.status] || '#94a3b8')}</td><td>${badgeHtml(task.priority || 'Medium', PRIORITY_COLORS[task.priority] || '#2363eb')}</td><td>${ownerCellHtml(task.owner)}</td><td>${formatDate(task.updated_at)}</td><td><button class="xd-btn ${isDone ? 'xd-btn-secondary' : 'xd-btn-primary'}" style="padding:6px 12px;font-size:11px;" onclick="agentRunner.runTask('${task.id}')" ${btnDisabled ? 'disabled' : ''}>${btnLabel}</button></td>`);
    tr.addEventListener('mouseenter', (evt) => showTooltip(evt, task.title, [task.description || 'No description', `Next checkpoint: ${task.next_checkpoint || 'n/a'}`]));
    tr.addEventListener('mousemove', moveTooltip);
    tr.addEventListener('mouseleave', hideTooltip);
    tr.addEventListener('click', () => dashNav.go('task-detail', { label: task.id, id: task.id }));
    body.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Issues list page
// ---------------------------------------------------------------------------
function renderIssuesPage(filterFn, filterLabel) {
  const list = filterFn ? issuesData.filter(filterFn) : issuesData;
  document.getElementById('issues-page-title').textContent = filterLabel ? `Issues — ${filterLabel}` : 'Issues';
  document.getElementById('issues-page-sub').textContent = filterLabel ? `Showing ${list.length} issue(s) filtered by ${filterLabel}.` : `Full list of ${list.length} tracked delivery issues.`;

  const total = list.length;
  const open = list.filter(i => i.status !== 'Resolved').length;
  const high = list.filter(i => i.severity === 'High' || i.severity === 'Critical').length;
  const escalations = list.filter(i => i.escalation_flag).length;
  const kpis = document.getElementById('issues-kpis');
  kpis.innerHTML = '';
  kpis.appendChild(buildKpiCard({ icon: '⚠️', iconColor: 'linear-gradient(135deg,#f5b544,#d24b57)', label: 'Total', value: total, trend: 'flat', trendText: 'in this view' }));
  kpis.appendChild(buildKpiCard({ icon: '🔓', iconColor: 'linear-gradient(135deg,#d24b57,#f5b544)', label: 'Open', value: open, trend: 'flat', trendText: `${total > 0 ? Math.round(open / total * 100) : 0}%` }));
  kpis.appendChild(buildKpiCard({ icon: '🔴', iconColor: 'linear-gradient(135deg,#5b3df0,#d24b57)', label: 'High/Critical', value: high, trend: 'flat', trendText: 'severity' }));
  kpis.appendChild(buildKpiCard({ icon: '🚨', iconColor: 'linear-gradient(135deg,#7c5cff,#5b3df0)', label: 'Escalations', value: escalations, trend: 'flat', trendText: 'flagged' }));

  const stackedSegments = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({
    label: sev, value: list.filter(i => i.severity === sev).length, color: SEVERITY_COLORS[sev],
    previewItems: list.filter(i => i.severity === sev).slice(0, 4).map(i => `${i.id}: ${i.title}`),
  }));
  const stackedBarWrap = document.getElementById('issues-stacked-bar');
  stackedBarWrap.innerHTML = '';
  stackedBarWrap.appendChild(buildStackedBar(stackedSegments, (seg) => dashNav.go('issues', { label: seg.label, filter: i => i.severity === seg.label, filterLabel: `${seg.label} severity` })));

  const body = document.getElementById('issues-body');
  body.innerHTML = '';
  if (!list.length) { body.innerHTML = `<tr><td colspan="6" class="xd-empty">No issues match this filter.</td></tr>`; return; }
  [...list].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)).forEach(issue => {
    const isResolved = issue.status === 'Resolved';
    const isRunning = agentRunner.current === 'issues' && agentRunner.runningIssueId === issue.id;
    const btnLabel = isRunning ? '⏹ Cancel' : (isResolved ? '✅ Resolved' : '▶ Run');
    const btnDisabled = isResolved || isRunning;
    const tr = el('tr', '', `<td>${issue.id}</td><td><strong>${issue.title}</strong></td><td>${badgeHtml(issue.severity, SEVERITY_COLORS[issue.severity] || '#94a3b8')}</td><td>${badgeHtml(issue.status, STATUS_COLORS[issue.status] || '#94a3b8')}</td><td>${ownerCellHtml(issue.owner)}</td><td>${formatDate(issue.updated_at)}</td><td><button class="xd-btn ${isResolved ? 'xd-btn-secondary' : 'xd-btn-primary'}" style="padding:6px 12px;font-size:11px;" onclick="agentRunner.runIssue('${issue.id}')" ${btnDisabled ? 'disabled' : ''}>${btnLabel}</button></td>`);
    tr.addEventListener('mouseenter', (evt) => showTooltip(evt, issue.title, [issue.description || 'No description', `Mitigation: ${issue.mitigation || 'n/a'}`]));
    tr.addEventListener('mousemove', moveTooltip);
    tr.addEventListener('mouseleave', hideTooltip);
    tr.addEventListener('click', () => dashNav.go('issue-detail', { label: issue.id, id: issue.id }));
    body.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// History Log page
// ---------------------------------------------------------------------------
function renderHistoryPage() {
  const body = document.getElementById('history-body');
  body.innerHTML = '';
  const entries = getFullHistoryLog().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (!entries.length) {
    body.innerHTML = `<tr><td colspan="4" class="xd-empty">No history recorded yet.</td></tr>`;
    return;
  }
  entries.forEach(entry => {
    const ts = new Date(entry.timestamp);
    const tsText = isNaN(ts) ? entry.timestamp || 'N/A' : ts.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
    const tr = el('tr', '', `<td>${tsText}</td><td>${entry.actor || 'system'}</td><td>${entry.action || '—'}</td><td>${entry.details || ''}</td>`);
    body.appendChild(tr);
  });
}

// Detail pages
// ---------------------------------------------------------------------------
function renderDetailFields(container, rows) {
  container.innerHTML = '';
  rows.forEach(([label, value]) => {
    const row = el('div', 'xd-detail-row', `<span>${label}</span><span>${value}</span>`);
    container.appendChild(row);
  });
}
function renderTimeline(container, entries) {
  container.innerHTML = '';
  if (!entries || !entries.length) { container.innerHTML = `<li class="xd-empty" style="border:none;padding-left:0;">No activity recorded.</li>`; return; }
  [...entries].reverse().forEach(entry => {
    const li = el('li', '', `<div class="xd-timeline-time">${formatDateTime(entry.timestamp)} · ${entry.actor || 'system'}</div><div class="xd-timeline-text">${entry.details || entry.action || ''}</div>`);
    container.appendChild(li);
  });
}

function renderTaskDetail(id) {
  const task = tasksData.find(t => t.id === id);
  if (!task) { document.getElementById('task-detail-title').textContent = 'Task not found'; return; }
  document.getElementById('task-detail-title').textContent = task.title;
  document.getElementById('task-detail-sub').innerHTML = `${task.id} &nbsp;·&nbsp; ${badgeHtml(task.status, STATUS_COLORS[task.status] || '#94a3b8')} &nbsp;${badgeHtml(task.priority || 'Medium', PRIORITY_COLORS[task.priority] || '#2363eb')}`;
  renderDetailFields(document.getElementById('task-detail-fields'), [
    ['Description', task.description || '—'],
    ['Owner', task.owner || 'Unassigned'],
    ['Dependency', task.dependency || '—'],
    ['Next checkpoint', task.next_checkpoint || '—'],
    ['Tags', (task.tags || []).map(t => `<span class="xd-pill">${t}</span>`).join(' ') || '—'],
    ['Created', formatDateTime(task.created_at)],
    ['Updated', formatDateTime(task.updated_at)],
  ]);
  renderTimeline(document.getElementById('task-detail-timeline'), task.activity_log);
}

function renderIssueDetail(id) {
  const issue = issuesData.find(i => i.id === id);
  if (!issue) { document.getElementById('issue-detail-title').textContent = 'Issue not found'; return; }
  document.getElementById('issue-detail-title').textContent = issue.title;
  document.getElementById('issue-detail-sub').innerHTML = `${issue.id} &nbsp;·&nbsp; ${badgeHtml(issue.severity, SEVERITY_COLORS[issue.severity] || '#94a3b8')} &nbsp;${badgeHtml(issue.status, STATUS_COLORS[issue.status] || '#94a3b8')}`;
  renderDetailFields(document.getElementById('issue-detail-fields'), [
    ['Description', issue.description || '—'],
    ['Owner', issue.owner || 'Unassigned'],
    ['Mitigation', issue.mitigation || '—'],
    ['Escalation required', issue.escalation_flag ? 'Yes' : 'No'],
    ['Related task', issue.related_task || '—'],
    ['Created', formatDateTime(issue.created_at)],
    ['Updated', formatDateTime(issue.updated_at)],
  ]);
  renderTimeline(document.getElementById('issue-detail-timeline'), issue.activity_log);
}

// ---------------------------------------------------------------------------
// Team page
// ---------------------------------------------------------------------------
function ownerStats() {
  const stats = {};
  tasksData.forEach(t => {
    const owner = t.owner || 'Unassigned';
    stats[owner] = stats[owner] || { assigned: 0, done: 0, issues: 0 };
    stats[owner].assigned++;
    if (t.status === 'Done') stats[owner].done++;
  });
  issuesData.forEach(i => {
    const owner = i.owner || 'Unassigned';
    stats[owner] = stats[owner] || { assigned: 0, done: 0, issues: 0 };
    stats[owner].issues++;
  });
  return stats;
}

function renderTeamPage() {
  const stats = ownerStats();
  const body = document.getElementById('team-body');
  body.innerHTML = '';
  const owners = Object.keys(stats);
  if (!owners.length) { body.innerHTML = `<tr><td colspan="5" class="xd-empty">No owners found.</td></tr>`; return; }
  owners.sort((a, b) => stats[b].assigned - stats[a].assigned).forEach(owner => {
    const s = stats[owner];
    const pct = s.assigned > 0 ? Math.round((s.done / s.assigned) * 100) : 0;
    const tr = el('tr', '', `<td>${ownerCellHtml(owner)}</td><td>${s.assigned}</td><td>${s.done}</td><td>${s.issues}</td><td style="min-width:160px;"><div class="xd-progress-track" style="margin-top:4px;"><div class="xd-progress-fill" style="width:${pct}%;background:${pct > 66 ? '#1f9d68' : pct > 33 ? '#f5b544' : '#d24b57'}"></div></div><small style="color:var(--ink-soft)">${pct}%</small></td>`);
    tr.addEventListener('click', () => dashNav.go('team-detail', { label: owner, owner }));
    body.appendChild(tr);
  });
}

function renderTeamDetail(owner) {
  document.getElementById('team-detail-title').textContent = owner;
  const ownerTasks = tasksData.filter(t => (t.owner || 'Unassigned') === owner);
  const ownerIssues = issuesData.filter(i => (i.owner || 'Unassigned') === owner);
  document.getElementById('team-detail-sub').textContent = `${ownerTasks.length} task(s), ${ownerIssues.length} issue(s) assigned.`;

  const tasksBody = document.getElementById('team-detail-tasks');
  tasksBody.innerHTML = ownerTasks.length ? '' : `<tr><td colspan="3" class="xd-empty">No tasks.</td></tr>`;
  ownerTasks.forEach(task => {
    const tr = el('tr', '', `<td>${task.id}</td><td>${task.title}</td><td>${badgeHtml(task.status, STATUS_COLORS[task.status] || '#94a3b8')}</td>`);
    tr.addEventListener('click', () => dashNav.go('task-detail', { label: task.id, id: task.id }));
    tasksBody.appendChild(tr);
  });

  const issuesBody = document.getElementById('team-detail-issues');
  issuesBody.innerHTML = ownerIssues.length ? '' : `<tr><td colspan="3" class="xd-empty">No issues.</td></tr>`;
  ownerIssues.forEach(issue => {
    const tr = el('tr', '', `<td>${issue.id}</td><td>${issue.title}</td><td>${badgeHtml(issue.severity, SEVERITY_COLORS[issue.severity] || '#94a3b8')}</td>`);
    tr.addEventListener('click', () => dashNav.go('issue-detail', { label: issue.id, id: issue.id }));
    issuesBody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Analytics page
// ---------------------------------------------------------------------------
function renderAnalyticsPage() {
  const totalTasks = tasksData.length;
  const doneTasks = tasksData.filter(t => t.status === 'Done').length;
  const totalIssues = issuesData.length;
  const resolvedIssues = issuesData.filter(i => i.status === 'Resolved').length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const resolutionRate = totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0;

  const kpis = document.getElementById('analytics-kpis');
  kpis.innerHTML = '';
  kpis.appendChild(buildKpiCard({ icon: '🎯', iconColor: 'linear-gradient(135deg,#1f9d68,#14b8a6)', label: 'Task completion rate', value: `${completionRate}%`, trend: 'flat', trendText: `${doneTasks}/${totalTasks} done` }));
  kpis.appendChild(buildKpiCard({ icon: '🛠️', iconColor: 'linear-gradient(135deg,#2363eb,#00a7f5)', label: 'Issue resolution rate', value: `${resolutionRate}%`, trend: 'flat', trendText: `${resolvedIssues}/${totalIssues} resolved` }));
  const ownersCount = new Set(tasksData.map(t => t.owner).filter(Boolean)).size;
  kpis.appendChild(buildKpiCard({ icon: '👥', iconColor: 'linear-gradient(135deg,#7c5cff,#5b3df0)', label: 'Active owners', value: ownersCount, trend: 'flat', trendText: 'contributing' }));
  const escalations = issuesData.filter(i => i.escalation_flag).length;
  kpis.appendChild(buildKpiCard({ icon: '🚨', iconColor: 'linear-gradient(135deg,#d24b57,#f5b544)', label: 'Escalations', value: escalations, trend: escalations > 0 ? 'down' : 'flat', trendText: 'flagged for review' }));

  const taskBuckets = dailyBuckets(tasksData);
  const issueBuckets = dailyBuckets(issuesData);
  const taskTrendWrap = document.getElementById('analytics-tasks-trend');
  taskTrendWrap.innerHTML = '';
  taskTrendWrap.appendChild(buildSparkline(taskBuckets.map(b => b.count), '#2363eb', 520, 120));
  const issueTrendWrap = document.getElementById('analytics-issues-trend');
  issueTrendWrap.innerHTML = '';
  issueTrendWrap.appendChild(buildSparkline(issueBuckets.map(b => b.count), '#d24b57', 520, 120));

  const stats = ownerStats();
  const teamBarsWrap = document.getElementById('analytics-team-bars');
  teamBarsWrap.innerHTML = '';
  const owners = Object.keys(stats).sort((a, b) => stats[b].assigned - stats[a].assigned).slice(0, 8);
  if (!owners.length) teamBarsWrap.innerHTML = `<div class="xd-empty">No owner data yet.</div>`;
  owners.forEach(owner => {
    const s = stats[owner];
    const bar = buildProgressBar(owner, s.done, s.assigned, s.assigned > 0 && (s.done / s.assigned) > 0.5 ? '#1f9d68' : '#f5b544');
    bar.style.cursor = 'pointer';
    bar.addEventListener('click', () => dashNav.go('team-detail', { label: owner, owner }));
    teamBarsWrap.appendChild(bar);
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
const reportsUI = {
  type: 'executive',
  init() {
    document.getElementById('report-type-selector').addEventListener('click', (e) => {
      const item = e.target.closest('.xd-report-type');
      if (!item) return;
      document.querySelectorAll('.xd-report-type').forEach(t => t.classList.remove('active'));
      item.classList.add('active');
      this.type = item.dataset.type;
      this.render();
    });
  },
  render() {
    const container = document.getElementById('report-preview');
    const now = new Date();
    const totalTasks = tasksData.length;
    const doneTasks = tasksData.filter(t => t.status === 'Done').length;
    const totalIssues = issuesData.length;
    const resolvedIssues = issuesData.filter(i => i.status === 'Resolved').length;
    const escalations = issuesData.filter(i => i.escalation_flag).length;

    let html = `<div class="xd-report-meta">Generated ${formatDateTime(now.toISOString())} by AISENA Dashboard</div>`;

    if (this.type === 'executive') {
      html += `<h2>Executive Summary</h2>`;
      html += `<div class="xd-report-kpis">
        <div class="xd-report-kpi"><b>${totalTasks}</b>Total tasks</div>
        <div class="xd-report-kpi"><b>${totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0}%</b>Task completion</div>
        <div class="xd-report-kpi"><b>${totalIssues}</b>Total issues</div>
        <div class="xd-report-kpi"><b>${totalIssues > 0 ? Math.round(resolvedIssues / totalIssues * 100) : 0}%</b>Issue resolution</div>
        <div class="xd-report-kpi"><b>${escalations}</b>Escalations</div>
      </div>`;
      html += `<h3>Task status breakdown</h3>` + reportTable(TASK_STATUSES.map(s => [s, tasksData.filter(t => t.status === s).length]), ['Status', 'Count']);
      html += `<h3>Issue severity breakdown</h3>` + reportTable(['Critical', 'High', 'Medium', 'Low'].map(s => [s, issuesData.filter(i => i.severity === s).length]), ['Severity', 'Count']);
    } else if (this.type === 'tasks') {
      html += `<h2>Task Report</h2>`;
      html += reportTable(tasksData.map(t => [t.id, t.title, t.status, t.priority, t.owner || '—']), ['ID', 'Title', 'Status', 'Priority', 'Owner']);
    } else if (this.type === 'issues') {
      html += `<h2>Issue Report</h2>`;
      html += reportTable(issuesData.map(i => [i.id, i.title, i.severity, i.status, i.owner || '—']), ['ID', 'Title', 'Severity', 'Status', 'Owner']);
    } else if (this.type === 'team') {
      html += `<h2>Team Report</h2>`;
      const stats = ownerStats();
      html += reportTable(Object.keys(stats).map(owner => [owner, stats[owner].assigned, stats[owner].done, stats[owner].issues]), ['Owner', 'Tasks assigned', 'Tasks done', 'Issues owned']);
    }
    container.innerHTML = html;
  },
  print() {
    this.render();
    window.print();
  },
  exportCSV() {
    let rows = [];
    if (this.type === 'tasks' || this.type === 'executive') {
      rows = [['ID', 'Title', 'Status', 'Priority', 'Owner'], ...tasksData.map(t => [t.id, t.title, t.status, t.priority, t.owner || ''])];
    } else if (this.type === 'issues') {
      rows = [['ID', 'Title', 'Severity', 'Status', 'Owner'], ...issuesData.map(i => [i.id, i.title, i.severity, i.status, i.owner || ''])];
    } else if (this.type === 'team') {
      const stats = ownerStats();
      rows = [['Owner', 'Tasks assigned', 'Tasks done', 'Issues owned'], ...Object.keys(stats).map(o => [o, stats[o].assigned, stats[o].done, stats[o].issues])];
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(csv, `${this.type}-report-${Date.now()}.csv`, 'text/csv');
    showToast('CSV export downloaded', 'success');
  },
  exportJSON() {
    const payload = { generatedAt: new Date().toISOString(), type: this.type, tasks: tasksData, issues: issuesData };
    downloadBlob(JSON.stringify(payload, null, 2), `${this.type}-report-${Date.now()}.json`, 'application/json');
    showToast('JSON export downloaded', 'success');
  },
};

function reportTable(rows, headers) {
  let html = `<table class="xd-report-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  if (!rows.length) html += `<tr><td colspan="${headers.length}">No data</td></tr>`;
  rows.forEach(row => { html += `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`; });
  html += '</tbody></table>';
  return html;
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const searchInput = document.getElementById('xd-search-input');
const searchResults = document.getElementById('xd-search-results');
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { searchResults.classList.remove('open'); return; }
  const taskMatches = tasksData.filter(t => t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)).slice(0, 5);
  const issueMatches = issuesData.filter(i => i.id.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)).slice(0, 5);
  searchResults.innerHTML = '';
  if (!taskMatches.length && !issueMatches.length) {
    searchResults.innerHTML = `<div class="xd-search-result">No matches found.</div>`;
  }
  taskMatches.forEach(task => {
    const row = el('div', 'xd-search-result', `📋 ${task.title}<small>${task.id} · ${task.status}</small>`);
    row.addEventListener('click', () => { searchResults.classList.remove('open'); searchInput.value = ''; dashNav.go('task-detail', { label: task.id, id: task.id }); });
    searchResults.appendChild(row);
  });
  issueMatches.forEach(issue => {
    const row = el('div', 'xd-search-result', `⚠️ ${issue.title}<small>${issue.id} · ${issue.severity}</small>`);
    row.addEventListener('click', () => { searchResults.classList.remove('open'); searchInput.value = ''; dashNav.go('issue-detail', { label: issue.id, id: issue.id }); });
    searchResults.appendChild(row);
  });
  searchResults.classList.add('open');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.xd-search')) searchResults.classList.remove('open');
});

// ---------------------------------------------------------------------------
// Loading / toast
// ---------------------------------------------------------------------------
function showLoading(show) {
  let overlay = document.getElementById('xd-loading-overlay');
  if (show) {
    if (!overlay) {
      overlay = el('div', 'xd-loading-overlay');
      overlay.id = 'xd-loading-overlay';
      overlay.innerHTML = `<div class="xd-spinner"></div>`;
      document.body.appendChild(overlay);
    }
  } else if (overlay) {
    overlay.remove();
  }
}
function showToast(message, type = 'info') {
  const colors = { error: ['#fdecec', '#d24b57'], success: ['#e9f8f1', '#1f9d68'], info: ['#eaf1ff', '#2363eb'] };
  const [bg, fg] = colors[type] || colors.info;
  const toast = el('div', 'xd-toast', message);
  toast.style.background = bg;
  toast.style.color = fg;
  toast.style.border = `1px solid ${fg}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
reportsUI.init();
loadDashboardData(false);

// Add Config menu item to the main dashboard sidebar
  const nav = document.getElementById('xd-primary-nav');
  if (nav) {
    const configItem = document.createElement('li');
    configItem.className = 'xd-nav-item';
    configItem.dataset.page = 'config';
    configItem.innerHTML = '<span class="xd-nav-icon">⚙️</span>Config';
    const reportsItem = nav.querySelector('[data-page="reports"]');
    if (reportsItem) {
      nav.insertBefore(configItem, reportsItem.nextSibling);
    } else {
      nav.appendChild(configItem);
    }
  }
