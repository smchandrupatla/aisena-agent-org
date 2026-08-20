// Testing Framework GUI JavaScript
// Comprehensive test management and analytics dashboard

// Global variables
let plansCache = [];
let runsCache = [];
let agentsCache = [];
let currentTab = 'recent-plans';
let currentSection = 'overview';

// API Base URL
const API_BASE = window.API_BASE_OVERRIDE || '';

// Initialize the GUI
function initTestingGUI() {
  document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
    setupEventListeners();
    updateSidebarStats();
  });
}

// Load initial data from API
async function loadInitialData() {
  showLoading(true);
  try {
    const [plans, runs, agents] = await Promise.all([
      fetchJson('/api/test-plans').then(data => data && Array.isArray(data.plans) ? data.plans : []),
      fetchJson('/api/test-runs').then(data => data && Array.isArray(data.runs) ? data.runs : []),
      fetchJson('/api/agents').then(data => data && Array.isArray(data.agents) ? data.agents : [])
    ]);
    
    plansCache = plans;
    runsCache = runs;
    agentsCache = agents;
    
    renderOverview();
    renderPlans();
    renderRuns();
    populateFilterOptions();
    updateAnalytics();
    loadActivityLog();
  } catch (error) {
    showNotification('Failed to load data', 'error');
  } finally {
    showLoading(false);
  }
}

// API helper functions
async function fetchJson(path) {
  try {
    const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

// Section navigation
function switchSection(section) {
  // Update sidebar
  document.querySelectorAll('.gui-nav-item').forEach(item => item.classList.remove('active'));
  event.target.closest('.gui-nav-item').classList.add('active');
  
  // Update sections
  document.querySelectorAll('.gui-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`${section}-section`).classList.add('active');
  
  currentSection = section;
  
  // Refresh data for specific sections
  if (section === 'test-plans') {
    renderPlans();
  } else if (section === 'test-runs') {
    renderRuns();
  } else if (section === 'analytics') {
    updateAnalytics();
  } else if (section === 'activity') {
    loadActivityLog();
  }
}

// Tab navigation
function switchTab(tab) {
  // Update tabs
  document.querySelectorAll('.gui-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.gui-tab-content').forEach(content => content.style.display = 'none');
  document.getElementById(`tab-${tab}`).style.display = 'block';
  
  currentTab = tab;
}

// Render overview dashboard
function renderOverview() {
  // Update metric cards
  document.getElementById('overviewPlanCount').textContent = plansCache.length;
  const executedRuns = runsCache.filter(r => r.status !== 'not_run');
  document.getElementById('overviewSuiteCount').textContent = executedRuns.length;
  
  const totalCases = runsCache.reduce((sum, r) => sum + (r.total || 0), 0);
  const passedCases = runsCache.reduce((sum, r) => sum + (r.passed || 0), 0);
  const passRate = totalCases > 0 ? Math.round(passedCases / totalCases * 100) : 0;
  document.getElementById('overviewPassRate').textContent = `${passRate}%`;
  document.getElementById('overviewProgressBar').style.width = `${passRate}%`;
  
  document.getElementById('overviewRunCount').textContent = runsCache.length;
  
  // Render recent plans
  const recentPlans = plansCache.slice(0, 5);
  const plansBody = document.getElementById('overviewPlansBody');
  plansBody.innerHTML = recentPlans.map(plan => {
    const latestRun = runsCache.find(r => r.plan_id === plan.id);
    const passRate = latestRun ? (latestRun.passed / latestRun.total * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${plan.title}</strong><br><span class="lede" style="font-size: 12px;">${plan.id}</span></td>
        <td>${plan.owner || 'Unassigned'}</td>
        <td><span class="gui-status-badge gui-status-${plan.status.toLowerCase()}">${plan.status}</span></td>
        <td>${(plan.suites || []).map(s => `<span class="pill">${s}</span>`).join(' ')}</td>
        <td>${latestRun ? `<span class="gui-status-badge gui-status-${latestRun.status}">${latestRun.status}</span>` : '<span class="gui-status-badge gui-status-not_run">no runs</span>'}</td>
        <td>${passRate}%</td>
      </tr>
    `;
  }).join('');
  
  // Render recent runs
  const recentRuns = runsCache.sort((a, b) => new Date(b.started_at || '') - new Date(a.started_at || '')).slice(0, 5);
  const runsBody = document.getElementById('overviewRunsBody');
  runsBody.innerHTML = recentRuns.map(run => {
    const results = run.total ? `${run.passed || 0}/${run.total} passed` : '-';
    return `
      <tr>
        <td>${run.id}</td>
        <td><span class="pill">${run.suite}</span></td>
        <td>${statusBadge(run.status)}</td>
        <td>${results}</td>
        <td>${run.duration_seconds || '-'}</td>
        <td>${formatDateTime(run.started_at)}</td>
      </tr>
    `;
  }).join('');
  
  // Update analytics
  updateAnalytics();
}

// Render plans table
function renderPlans() {
  const filteredPlans = applyPlanFilters();
  const plansBody = document.getElementById('plansBody');
  
  if (!filteredPlans.length) {
    plansBody.innerHTML = '<tr><td colspan="7">No test plans match the current filters.</td></tr>';
    return;
  }
  
  plansBody.innerHTML = filteredPlans.map(plan => {
    const planRuns = runsCache.filter(r => r.plan_id === plan.id);
    const latestRun = planRuns.length > 0 ? planRuns[planRuns.length - 1] : null;
    return `
      <tr>
        <td>${plan.id}</td>
        <td><strong>${plan.title}</strong></td>
        <td>${plan.owner || 'Unassigned'}</td>
        <td><span class="gui-status-badge gui-status-${plan.status.toLowerCase()}">${plan.status}</span></td>
        <td>${(plan.suites || []).map(s => `<span class="pill">${s}</span>`).join(' ')}</td>
        <td>${formatDateTime(plan.created_at)}</td>
        <td>
          <button class="gui-button gui-button-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="viewPlanDetails('${plan.id}')">View</button>
          <button class="gui-button gui-button-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deletePlan('${plan.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Render runs table
function renderRuns() {
  const filteredRuns = applyRunFilters();
  const runsBody = document.getElementById('runsBody');
  
  if (!filteredRuns.length) {
    runsBody.innerHTML = '<tr><td colspan="8">No test runs match the current filters.</td></tr>';
    return;
  }
  
  runsBody.innerHTML = filteredRuns.map(run => {
    const plan = plansCache.find(p => p.id === run.plan_id);
    const results = run.total ? `${run.passed || 0}/${run.total} passed` : '-';
    return `
      <tr>
        <td>${run.id}</td>
        <td><span class="pill">${run.suite}</span></td>
        <td>${plan ? plan.title : (run.plan_id || '-')}</td>
        <td>${statusBadge(run.status)}</td>
        <td>${results}</td>
        <td>${run.duration_seconds || '-'}</td>
        <td>${formatDateTime(run.started_at)}</td>
        <td>
          <button class="gui-button gui-button-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="viewRunDetails('${run.id}')">View</button>
          <button class="gui-button gui-button-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteRun('${run.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter functions
function applyPlanFilters() {
  const q = document.getElementById('planFilterText').value.toLowerCase();
  const status = document.getElementById('planFilterStatus').value;
  const owner = document.getElementById('planFilterOwner').value;
  
  return plansCache.filter(plan => {
    if (q && !`${plan.title} ${plan.description}`.toLowerCase().includes(q)) return false;
    if (status && plan.status !== status) return false;
    if (owner && plan.owner !== owner) return false;
    return true;
  });
}

function applyRunFilters() {
  const suite = document.getElementById('runFilterSuite').value;
  const status = document.getElementById('runFilterStatus').value;
  const plan = document.getElementById('runFilterPlan').value;
  
  return runsCache.filter(run => {
    if (suite && run.suite !== suite) return false;
    if (status && run.status !== status) return false;
    if (plan && run.plan_id !== plan) return false;
    return true;
  });
}

// Event listeners
function setupEventListeners() {
  // Plan filters
  document.getElementById('planFilterText').addEventListener('input', () => {
    renderPlans();
  });
  
  document.getElementById('planFilterStatus').addEventListener('change', () => {
    renderPlans();
  });
  
  document.getElementById('planFilterOwner').addEventListener('change', () => {
    renderPlans();
  });
  
  // Run filters
  document.getElementById('runFilterSuite').addEventListener('change', () => {
    renderRuns();
  });
  
  document.getElementById('runFilterStatus').addEventListener('change', () => {
    renderRuns();
  });
  
  document.getElementById('runFilterPlan').addEventListener('change', () => {
    renderRuns();
  });
  
  // Forms
  document.getElementById('planForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await createPlan();
  });
  
  document.getElementById('runForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await createRun();
  });
}

// API calls
async function createPlan() {
  const formData = {
    title: document.getElementById('planTitle').value,
    description: document.getElementById('planDescription').value,
    owner: document.getElementById('planOwner').value,
    status: document.getElementById('planStatus').value,
    suites: document.getElementById('planSuites').value.split(',').map(s => s.trim()).filter(Boolean)
  };
  
  try {
    const response = await fetch(`${API_BASE}/api/test-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      const newPlan = await response.json();
      plansCache.push(newPlan.plan);
      closePlanDialog();
      showNotification('Test plan created successfully', 'success');
      renderOverview();
      renderPlans();
      updateSidebarStats();
    } else {
      showNotification('Failed to create test plan', 'error');
    }
  } catch (error) {
    showNotification('Error creating test plan', 'error');
  }
}

async function createRun() {
  const formData = {
    suite: document.getElementById('runSuite').value,
    plan_id: document.getElementById('runPlan').value || null,
    status: document.getElementById('runStatus').value,
    total: parseInt(document.getElementById('runTotal').value) || null,
    passed: parseInt(document.getElementById('runPassed').value) || null,
    failed: parseInt(document.getElementById('runFailed').value) || null,
    duration_seconds: parseInt(document.getElementById('runDuration').value) || null,
    notes: document.getElementById('runNotes').value,
    triggered_by: 'gui'
  };
  
  try {
    const response = await fetch(`${API_BASE}/api/test-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      const newRun = await response.json();
      runsCache.push(newRun.run);
      closeRunDialog();
      showNotification('Test run logged successfully', 'success');
      renderOverview();
      renderRuns();
      updateSidebarStats();
    } else {
      showNotification('Failed to log test run', 'error');
    }
  } catch (error) {
    showNotification('Error logging test run', 'error');
  }
}

// Utility functions
function statusBadge(status) {
  const label = (status || "unknown").replace(/_/g, " ");
  return `<span class="gui-status-badge gui-status-${status || "unknown"}">${label}</span>`;
}

function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch (err) {
    return iso;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// UI helpers
function showLoading(show) {
  // Implement loading indicator
}

function showNotification(message, type) {
  const container = document.getElementById('notificationContainer');
  const notification = document.createElement('div');
  notification.className = `gui-notification ${type}`;
  notification.textContent = message;
  container.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      container.removeChild(notification);
    }, 300);
  }, 3000);
}

function toggleSidebar() {
  document.getElementById('guiSidebar').classList.toggle('open');
}

function closePlanDialog() {
  document.getElementById('planDialog').classList.remove('show');
  document.getElementById('planForm').reset();
}

function closeRunDialog() {
  document.getElementById('runDialog').classList.remove('show');
  document.getElementById('runForm').reset();
}

function showAddPlanDialog() {
  document.getElementById('planDialog').classList.add('show');
}

function showAddRunDialog() {
  populatePlanSelect();
  document.getElementById('runDialog').classList.add('show');
}

function populatePlanSelect() {
  const select = document.getElementById('runPlan');
  select.innerHTML = '<option value="">None</option>' + 
    plansCache.map(plan => `<option value="${plan.id}">${plan.id} - ${plan.title}</option>`).join('');
}

function populateFilterOptions() {
  // Populate suite filter
  const suiteSelect = document.getElementById('runFilterSuite');
  const suites = [...new Set(runsCache.map(r => r.suite))].sort();
  suiteSelect.innerHTML = '<option value="">All Suites</option>' + 
    suites.map(suite => `<option value="${suite}">${suite}</option>`).join('');
  
  // Populate owner filter
  const ownerSelect = document.getElementById('planFilterOwner');
  const owners = [...new Set(plansCache.map(p => p.owner))].filter(Boolean);
  ownerSelect.innerHTML = '<option value="">All Owners</option>' + 
    owners.map(owner => `<option value="${owner}">${owner}</option>`).join('');
  
  // Populate actor filter
  const actorSelect = document.getElementById('activityFilterActor');
  const actors = [...new Set(runsCache.map(r => r.triggered_by))].filter(Boolean);
  actorSelect.innerHTML = '<option value="">All Actors</option>' + 
    actors.map(actor => `<option value="${actor}">${actor}</option>`).join('');
}

function updateSidebarStats() {
  document.getElementById('sidebarPlanCount').textContent = plansCache.length;
  document.getElementById('sidebarSuiteCount').textContent = runsCache.filter(r => r.status !== 'not_run').length;
  document.getElementById('sidebarPassRate').textContent = '-';
  document.getElementById('sidebarRunCount').textContent = runsCache.length;
}

function updateAnalytics() {
  const totalPlans = plansCache.length;
  const totalRuns = runsCache.length;
  const totalCases = runsCache.reduce((sum, r) => sum + (r.total || 0), 0);
  const passedCases = runsCache.reduce((sum, r) => sum + (r.passed || 0), 0);
  const passRate = totalCases > 0 ? Math.round(passedCases / totalCases * 100) : 0;
  const avgDuration = totalRuns > 0 ? runsCache.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / totalRuns : 0;
  
  document.getElementById('analyticsTotalPlans').textContent = totalPlans;
  document.getElementById('analyticsTotalRuns').textContent = totalRuns;
  document.getElementById('analyticsPassRate').textContent = `${passRate}%`;
  document.getElementById('analyticsAvgDuration').textContent = avgDuration.toFixed(1);
  
  // Update best/worst suites
  const suiteStats = {};
  runsCache.forEach(run => {
    if (!suiteStats[run.suite]) {
      suiteStats[run.suite] = { passed: 0, total: 0, runs: 0 };
    }
    if (run.total) {
      suiteStats[run.suite].total += run.total;
      suiteStats[run.suite].passed += run.passed || 0;
    }
    suiteStats[run.suite].runs++;
  });
  
  const suitesArray = Object.entries(suiteStats);
  if (suitesArray.length > 0) {
    suitesArray.sort((a, b) => b[1].total - a[1].total);
    const bestSuite = suitesArray[0];
    const worstSuite = suitesArray[suitesArray.length - 1];
    
    document.getElementById('bestSuite').textContent = bestSuite[0];
    document.getElementById('worstSuite').textContent = worstSuite[0];
  }
}

function loadActivityLog() {
  // Load activity log from local storage or API
  const activityLog = JSON.parse(localStorage.getItem('activityLog') || '[]');
  const filteredLog = filterActivityLog(activityLog);
  
  const logContainer = document.getElementById('activityLog');
  if (!filteredLog.length) {
    logContainer.innerHTML = '<div class="gui-empty-state">No activity logs match the current filters.</div>';
    return;
  }
  
  logContainer.innerHTML = filteredLog.map(item => `
    <div class="gui-activity-item">
      <span class="gui-activity-timestamp">${formatDateTime(item.timestamp)}</span>
      <span class="gui-activity-actor">${item.actor}</span>
      <div class="gui-activity-message">${item.action}: ${item.details}</div>
    </div>
  `).join('');
}

function filterActivityLog(log) {
  const actor = document.getElementById('activityFilterActor').value;
  const action = document.getElementById('activityFilterAction').value;
  
  return log.filter(item => {
    if (actor && item.actor !== actor) return false;
    if (action && item.action !== action) return false;
    return true;
  });
}

// Quick actions
function showQuickActions() {
  const actions = [
    { title: 'Add Test Plan', action: showAddPlanDialog },
    { title: 'Log Test Run', action: showAddRunDialog },
    { title: 'Refresh Data', action: loadInitialData },
    { title: 'Export Reports', action: () => showNotification('Export functionality coming soon', 'info') }
  ];
  
  const modal = document.createElement('div');
  modal.className = 'gui-modal show';
  modal.innerHTML = `
    <div class="gui-modal-content">
      <div class="gui-dialog-header">
        <h3>Quick Actions</h3>
        <button class="gui-button gui-button-secondary" onclick="this.closest('.gui-modal').classList.remove('show')">✕</button>
      </div>
      <div class="gui-card-grid">
        ${actions.map(action => `
          <div class="gui-metric-card" onclick="${action.action.name}(); this.closest('.gui-modal').classList.remove('show')">
            <h4>${action.title}</h4>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
      setTimeout(() => document.body.removeChild(modal), 300);
    }
  });
}

function exportReport(format) {
  showNotification(`Exporting report as ${format.toUpperCase()}...`, 'info');
  // Implement export functionality
}

// View details functions
function viewPlanDetails(planId) {
  const plan = plansCache.find(p => p.id === planId);
  if (!plan) return;
  
  showNotification(`Viewing plan details for ${plan.title}`, 'info');
  // Implement plan details view
}

function viewRunDetails(runId) {
  const run = runsCache.find(r => r.id === runId);
  if (!run) return;
  
  showNotification(`Viewing run details for ${run.id}`, 'info');
  // Implement run details view
}

function deletePlan(planId) {
  if (confirm('Are you sure you want to delete this test plan?')) {
    plansCache = plansCache.filter(p => p.id !== planId);
    runsCache = runsCache.filter(r => r.plan_id !== planId);
    renderOverview();
    renderPlans();
    updateSidebarStats();
    showNotification('Test plan deleted', 'success');
  }
}

function deleteRun(runId) {
  if (confirm('Are you sure you want to delete this test run?')) {
    runsCache = runsCache.filter(r => r.id !== runId);
    renderOverview();
    renderRuns();
    updateSidebarStats();
    showNotification('Test run deleted', 'success');
  }
}

// Initialize the GUI
initTestingGUI();

console.log('Testing Framework GUI initialized');