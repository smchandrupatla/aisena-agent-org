// App Dashboard: tracks tasks and issues for a selected app label.
// Supports label-based filtering, inline label editing, and drill-down navigation.
// Data sources: /api/tasks?app_label=<label>, /api/issues?app_label=<label>, /api/app-labels

const API_BASE = window.API_BASE_OVERRIDE || '';

const TASK_STATUSES = ["Backlog", "Planned", "In Progress", "Blocked", "In Review", "Done"];
const ISSUE_STATUSES = ["Open", "Triaged", "Mitigating", "Monitoring", "Verifying", "Resolved"];

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
let appLabels = [];
let selectedAppLabel = '';
let lastLoadedAt = null;

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const appDashNav = {
  stack: [{ page: 'overview', label: 'Overview' }],
  current() { return this.stack[this.stack.length - 1]; },
  go(page, opts = {}) {
    const entry = { page, label: opts.label || page, ...opts };
    this.stack.push(entry);
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
  appDashNav.stack.forEach((entry, idx) => {
    if (idx > 0) el.appendChild(document.createTextNode(' / '));
    const span = document.createElement('span');
    span.className = 'xd-crumb';
    span.textContent = idx === 0 ? 'App Dashboard' : entry.label;
    if (idx < appDashNav.stack.length - 1) {
      span.addEventListener('click', () => appDashNav.jumpTo(idx));
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
    case 'tasks': renderTasksPage(); break;
    case 'issues': renderIssuesPage(); break;
    case 'labels': renderLabelsPage(); break;
  }
}

document.getElementById('xd-primary-nav').addEventListener('click', (e) => {
  const item = e.target.closest('.xd-nav-item');
  if (!item) return;
  appDashNav.goRoot(item.dataset.page, item.textContent.trim());
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

async function loadAppDashboardData(isRefresh) {
  showLoading(true);
  try {
    const [labelsResp, tasksResp, issuesResp, agentsResp] = await Promise.all([
      fetchJson('/api/app-labels'),
      fetchJson(selectedAppLabel ? `/api/tasks?app_label=${encodeURIComponent(selectedAppLabel)}` : '/api/tasks'),
      fetchJson(selectedAppLabel ? `/api/issues?app_label=${encodeURIComponent(selectedAppLabel)}` : '/api/issues'),
      fetchJson('/api/agents'),
    ]);

    appLabels = (labelsResp && Array.isArray(labelsResp.app_labels)) ? labelsResp.app_labels : [];
    tasksData = (tasksResp && Array.isArray(tasksResp.tasks)) ? tasksResp.tasks : [];
    issuesData = Array.isArray(issuesResp) ? issuesResp : (issuesResp && Array.isArray(issuesResp.issues) ? issuesResp.issues : []);
    agentsData = (agentsResp && Array.isArray(agentsResp.agents)) ? agentsResp.agents : [];
    lastLoadedAt = new Date();

    document.getElementById('nav-count-tasks').textContent = tasksData.length;
    document.getElementById('nav-count-issues').textContent = issuesData.length;
    updateSidebarProgress();
    populateLabelSelector();
    appDashNav.render();
    if (isRefresh) showToast('Dashboard refreshed', 'success');
  } catch (err) {
    showToast('Failed to load dashboard data', 'error');
  } finally {
    showLoading(false);
  }
}

function populateLabelSelector() {
  const select = document.getElementById('appLabelSelect');
  if (!select) return;
  const current = selectedAppLabel;
  select.innerHTML = '<option value="">All apps</option>' + appLabels.map(l => `<option value="${l}">${l}</option>`).join('');
  select.value = current;
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
// Label selector change handler
// ---------------------------------------------------------------------------
document.getElementById('appLabelSelect').addEventListener('change', (e) => {
  selectedAppLabel = e.target.value;
  loadAppDashboardData(false);
});

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
function labelHtml(label) {
  if (!label) return '<span style="color:var(--ink-soft)">—</span>';
  return `<span class="xd-label-chip">${label}</span>`;
}

// ---------------------------------------------------------------------------
// Donut chart
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
// Sparkline
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
// KPI card
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
// Progress bar
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

// ---------------------------------------------------------------------------
// Stacked bar
// ---------------------------------------------------------------------------
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
// Tooltip
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
    onClick: () => appDashNav.go('tasks', { label: 'All tasks' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '✅', iconColor: 'linear-gradient(135deg,#1f9d68,#14b8a6)', label: 'Completed', value: doneTasks,
    trend: doneTasks > 0 ? 'up' : 'flat', trendText: `${totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}% completion rate`,
    onClick: () => appDashNav.go('tasks', { label: 'Done' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '⏳', iconColor: 'linear-gradient(135deg,#7c5cff,#5b3df0)', label: 'In progress', value: inProgressTasks,
    trend: 'flat', trendText: 'Active right now',
    onClick: () => appDashNav.go('tasks', { label: 'In Progress' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '🚧', iconColor: 'linear-gradient(135deg,#d24b57,#f5b544)', label: 'Blocked', value: blockedTasks,
    trend: blockedTasks > 0 ? 'down' : 'flat', trendText: blockedTasks > 0 ? 'Needs attention' : 'None blocked',
    onClick: () => appDashNav.go('tasks', { label: 'Blocked' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '⚠️', iconColor: 'linear-gradient(135deg,#f5b544,#d24b57)', label: 'Open issues', value: openIssues,
    trend: trendDirection(issueBuckets), trendText: `${issueBuckets.slice(7).reduce((s, b) => s + b.count, 0)} reported this week`,
    sparkValues: issueBuckets.map(b => b.count), sparkColor: '#d24b57',
    onClick: () => appDashNav.go('issues', { label: 'Open issues' }),
  }));
  kpiGrid.appendChild(buildKpiCard({
    icon: '🚨', iconColor: 'linear-gradient(135deg,#5b3df0,#d24b57)', label: 'Escalations', value: escalations,
    trend: escalations > 0 ? 'down' : 'flat', trendText: escalations > 0 ? 'Requires executive review' : 'No escalations',
    onClick: () => appDashNav.go('issues', { label: 'Escalations' }),
  }));

  // Task status donut
  const statusSegments = TASK_STATUSES.map(status => ({
    label: status, value: tasksData.filter(t => t.status === status).length, color: STATUS_COLORS[status],
    previewItems: tasksData.filter(t => t.status === status).slice(0, 4).map(t => `${t.id}: ${t.title}`),
  }));
  renderDonut(document.getElementById('task-donut-svg'), document.getElementById('task-donut-legend'), statusSegments, {
    centerLabel: 'Tasks',
    onSegmentClick: (seg) => appDashNav.go('tasks', { label: seg.label }),
  });

  // Issue severity donut
  const severitySegments = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({
    label: sev, value: issuesData.filter(i => i.severity === sev).length, color: SEVERITY_COLORS[sev],
    previewItems: issuesData.filter(i => i.severity === sev).slice(0, 4).map(i => `${i.id}: ${i.title}`),
  }));
  renderDonut(document.getElementById('issue-donut-svg'), document.getElementById('issue-donut-legend'), severitySegments, {
    centerLabel: 'Issues',
    onSegmentClick: (seg) => appDashNav.go('issues', { label: seg.label }),
  });

  // Progress bars
  const progressWrap = document.getElementById('overview-progress-bars');
  progressWrap.innerHTML = '';
  progressWrap.appendChild(buildProgressBar('Task completion (Done)', doneTasks, totalTasks, '#1f9d68'));
  progressWrap.appendChild(buildProgressBar('Issue resolution (Resolved)', issuesData.filter(i => i.status === 'Resolved').length, totalIssues, '#2363eb'));

  // Recent tasks
  const recentTasks = [...tasksData].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)).slice(0, 6);
  const overviewTasksBody = document.getElementById('overview-tasks-body');
  overviewTasksBody.innerHTML = '';
  if (!recentTasks.length) overviewTasksBody.innerHTML = `<tr><td colspan="5" class="xd-empty">No tasks yet.</td></tr>`;
  recentTasks.forEach(task => {
    const tr = el('tr', '', `<td><strong>${task.title}</strong><br><small style="color:var(--ink-soft)">${task.id}</small></td><td>${labelHtml(task.app_label)}</td><td>${badgeHtml(task.status, STATUS_COLORS[task.status] || '#94a3b8')}</td><td>${badgeHtml(task.priority || 'Medium', PRIORITY_COLORS[task.priority] || '#2363eb')}</td><td>${ownerCellHtml(task.owner)}</td>`);
    tr.addEventListener('mouseenter', (evt) => showTooltip(evt, task.title, [task.description || 'No description', `Next: ${task.next_checkpoint || 'n/a'}`]));
    tr.addEventListener('mousemove', moveTooltip);
    tr.addEventListener('mouseleave', hideTooltip);
    overviewTasksBody.appendChild(tr);
  });

  // Recent issues
  const recentIssues = [...issuesData].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)).slice(0, 6);
  const overviewIssuesBody = document.getElementById('overview-issues-body');
  overviewIssuesBody.innerHTML = '';
  if (!recentIssues.length) overviewIssuesBody.innerHTML = `<tr><td colspan="5" class="xd-empty">No issues yet.</td></tr>`;
  recentIssues.forEach(issue => {
    const tr = el('tr', '', `<td><strong>${issue.title}</strong><br><small style="color:var(--ink-soft)">${issue.id}</small></td><td>${labelHtml(issue.app_label)}</td><td>${badgeHtml(issue.severity, SEVERITY_COLORS[issue.severity] || '#94a3b8')}</td><td>${badgeHtml(issue.status, STATUS_COLORS[issue.status] || '#94a3b8')}</td><td>${ownerCellHtml(issue.owner)}</td>`);
    tr.addEventListener('mouseenter', (evt) => showTooltip(evt, issue.title, [issue.description || 'No description', `Mitigation: ${issue.mitigation || 'n/a'}`]));
    tr.addEventListener('mousemove', moveTooltip);
    tr.addEventListener('mouseleave', hideTooltip);
    overviewIssuesBody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Tasks page
// ---------------------------------------------------------------------------
function renderTasksPage() {
  document.getElementById('tasks-page-title').textContent = selectedAppLabel ? `Tasks — ${selectedAppLabel}` : 'Tasks';
  document.getElementById('tasks-page-sub').textContent = selectedAppLabel ? `Showing ${tasksData.length} task(s) for app "${selectedAppLabel}".` : `Full list of ${tasksData.length} tracked delivery tasks.`;

  const total = tasksData.length;
  const done = tasksData.filter(t => t.status === 'Done').length;
  const inProgress = tasksData.filter(t => t.status === 'In Progress').length;
  const blocked = tasksData.filter(t => t.status === 'Blocked').length;
  const kpis = document.getElementById('tasks-kpis');
  kpis.innerHTML = '';
  kpis.appendChild(buildKpiCard({ icon: '📋', iconColor: 'linear-gradient(135deg,#2363eb,#00a7f5)', label: 'Total', value: total, trend: 'flat', trendText: 'in this view' }));
  kpis.appendChild(buildKpiCard({ icon: '✅', iconColor: 'linear-gradient(135deg,#1f9d68,#14b8a6)', label: 'Done', value: done, trend: 'flat', trendText: `${total > 0 ? Math.round(done / total * 100) : 0}%` }));
  kpis.appendChild(buildKpiCard({ icon: '⏳', iconColor: 'linear-gradient(135deg,#7c5cff,#5b3df0)', label: 'In progress', value: inProgress, trend: 'flat', trendText: 'active' }));
  kpis.appendChild(buildKpiCard({ icon: '🚧', iconColor: 'linear-gradient(135deg,#d24b57,#f5b544)', label: 'Blocked', value: blocked, trend: 'flat', trendText: 'blocked' }));

  const stackedSegments = TASK_STATUSES.map(status => ({
    label: status, value: tasksData.filter(t => t.status === status).length, color: STATUS_COLORS[status],
    previewItems: tasksData.filter(t => t.status === status).slice(0, 4).map(t => `${t.id}: ${t.title}`),
  }));
  const stackedBarWrap = document.getElementById('tasks-stacked-bar');
  stackedBarWrap.innerHTML = '';
  stackedBarWrap.appendChild(buildStackedBar(stackedSegments, (seg) => appDashNav.go('tasks', { label: seg.label })));

  const body = document.getElementById('tasks-body');
  body.innerHTML = '';
  if (!tasksData.length) { body.innerHTML = `<tr><td colspan="7" class="xd-empty">No tasks match this view.</td></tr>`; return; }
  [...tasksData].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)).forEach(task => {
    const tr = el('tr', '', `<td>${task.id}</td><td><strong>${task.title}</strong></td><td>${labelHtml(task.app_label)}</td><td>${badgeHtml(task.status, STATUS_COLORS[task.status] || '#94a3b8')}</td><td>${badgeHtml(task.priority || 'Medium', PRIORITY_COLORS[task.priority] || '#2363eb')}</td><td>${ownerCellHtml(task.owner)}</td><td>${formatDate(task.updated_at)}</td>`);
    tr.addEventListener('mouseenter', (evt) => showTooltip(evt, task.title, [task.description || 'No description', `Next checkpoint: ${task.next_checkpoint || 'n/a'}`]));
    tr.addEventListener('mousemove', moveTooltip);
    tr.addEventListener('mouseleave', hideTooltip);
    body.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Issues page
// ---------------------------------------------------------------------------
function renderIssuesPage() {
  document.getElementById('issues-page-title').textContent = selectedAppLabel ? `Issues — ${selectedAppLabel}` : 'Issues';
  document.getElementById('issues-page-sub').textContent = selectedAppLabel ? `Showing ${issuesData.length} issue(s) for app "${selectedAppLabel}".` : `Full list of ${issuesData.length} tracked delivery issues.`;

  const total = issuesData.length;
  const open = issuesData.filter(i => i.status !== 'Resolved').length;
  const high = issuesData.filter(i => i.severity === 'High' || i.severity === 'Critical').length;
  const escalations = issuesData.filter(i => i.escalation_flag).length;
  const kpis = document.getElementById('issues-kpis');
  kpis.innerHTML = '';
  kpis.appendChild(buildKpiCard({ icon: '⚠️', iconColor: 'linear-gradient(135deg,#f5b544,#d24b57)', label: 'Total', value: total, trend: 'flat', trendText: 'in this view' }));
  kpis.appendChild(buildKpiCard({ icon: '🔓', iconColor: 'linear-gradient(135deg,#d24b57,#f5b544)', label: 'Open', value: open, trend: 'flat', trendText: `${total > 0 ? Math.round(open / total * 100) : 0}%` }));
  kpis.appendChild(buildKpiCard({ icon: '🔴', iconColor: 'linear-gradient(135deg,#5b3df0,#d24b57)', label: 'High/Critical', value: high, trend: 'flat', trendText: 'severity' }));
  kpis.appendChild(buildKpiCard({ icon: '🚨', iconColor: 'linear-gradient(135deg,#7c5cff,#5b3df0)', label: 'Escalations', value: escalations, trend: 'flat', trendText: 'flagged' }));

  const stackedSegments = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({
    label: sev, value: issuesData.filter(i => i.severity === sev).length, color: SEVERITY_COLORS[sev],
    previewItems: issuesData.filter(i => i.severity === sev).slice(0, 4).map(i => `${i.id}: ${i.title}`),
  }));
  const stackedBarWrap = document.getElementById('issues-stacked-bar');
  stackedBarWrap.innerHTML = '';
  stackedBarWrap.appendChild(buildStackedBar(stackedSegments, (seg) => appDashNav.go('issues', { label: seg.label })));

  const body = document.getElementById('issues-body');
  body.innerHTML = '';
  if (!issuesData.length) { body.innerHTML = `<tr><td colspan="7" class="xd-empty">No issues match this view.</td></tr>`; return; }
  [...issuesData].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)).forEach(issue => {
    const tr = el('tr', '', `<td>${issue.id}</td><td><strong>${issue.title}</strong></td><td>${labelHtml(issue.app_label)}</td><td>${badgeHtml(issue.severity, SEVERITY_COLORS[issue.severity] || '#94a3b8')}</td><td>${badgeHtml(issue.status, STATUS_COLORS[issue.status] || '#94a3b8')}</td><td>${ownerCellHtml(issue.owner)}</td><td>${formatDate(issue.updated_at)}</td>`);
    tr.addEventListener('mouseenter', (evt) => showTooltip(evt, issue.title, [issue.description || 'No description', `Mitigation: ${issue.mitigation || 'n/a'}`]));
    tr.addEventListener('mousemove', moveTooltip);
    tr.addEventListener('mouseleave', hideTooltip);
    body.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Labels page
// ---------------------------------------------------------------------------
function renderLabelsPage() {
  const container = document.getElementById('labels-list');
  container.innerHTML = '';
  if (!appLabels.length) {
    container.innerHTML = `<div class="xd-empty">No app labels found yet. Add one below.</div>`;
    return;
  }
  appLabels.forEach(label => {
    const count = tasksData.filter(t => t.app_label === label).length + issuesData.filter(i => i.app_label === label).length;
    const row = el('div', 'xd-label-row', '');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:12px;border:1px solid var(--line);background:var(--bg-soft);margin-bottom:8px;';
    row.innerHTML = `
      <span style="font-weight:600;">${label}</span>
      <span style="font-size:12px;color:var(--ink-soft);">${count} item(s)</span>
      <div style="display:flex;gap:8px;">
        <button class="xd-btn xd-btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="renameLabel('${label}')">✏️ Rename</button>
        <button class="xd-btn xd-btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="filterByLabel('${label}')">🔍 Filter</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function renameLabel(oldLabel) {
  const newLabel = prompt('Enter the new name for this app label:', oldLabel);
  if (!newLabel || newLabel.trim() === oldLabel) return;
  const trimmed = newLabel.trim();
  showLoading(true);
  // Rename app_label on all matching tasks
  fetch(`${API_BASE}/api/tasks`, { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
      const tasks = (data && Array.isArray(data.tasks)) ? data.tasks : [];
      const updates = tasks
        .filter(t => t.app_label === oldLabel)
        .map(t => fetch(`${API_BASE}/api/tasks/${encodeURIComponent(t.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_label: trimmed, actor: 'user' }),
        }).then(r => r.ok));
      return Promise.all(updates);
    })
    .then(() => {
      // Rename app_label on all matching issues
      return fetch(`${API_BASE}/api/issues`, { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
          const issues = Array.isArray(data) ? data : (data && Array.isArray(data.issues) ? data.issues : []);
          const updates = issues
            .filter(i => i.app_label === oldLabel)
            .map(i => fetch(`${API_BASE}/api/issues/${encodeURIComponent(i.id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ app_label: trimmed }),
            }).then(r => r.ok));
          return Promise.all(updates);
        });
    })
    .then(() => {
      showLoading(false);
      showToast(`Label renamed from "${oldLabel}" to "${trimmed}"`, 'success');
      loadAppDashboardData(false);
    })
    .catch(err => {
      showLoading(false);
      showToast(`Failed to rename label: ${err.message}`, 'error');
    });
}

function filterByLabel(label) {
  selectedAppLabel = label;
  document.getElementById('appLabelSelect').value = label;
  loadAppDashboardData(false);
  appDashNav.goRoot('overview', 'Overview');
}

function addNewLabel() {
  const input = document.getElementById('newLabelInput');
  const name = input.value.trim();
  if (!name) return;
  if (appLabels.includes(name)) {
    showToast(`Label "${name}" already exists`, 'error');
    return;
  }
  appLabels.push(name);
  appLabels.sort();
  input.value = '';
  showToast(`Label "${name}" added`, 'success');
  renderLabelsPage();
  populateLabelSelector();
}

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
appDashNav.render();
loadAppDashboardData(false);
