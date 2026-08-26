import { runCopilotAction } from './copilot-actions.js';

export async function initJobExecution(state) {
  const jobSelector = document.getElementById('jobSelector');
  const agentSelectorRow = document.getElementById('agentSelectorRow');
  const agentSelector = document.getElementById('agentSelector');
  const instructions = document.getElementById('jobInstructions');
  const runBtn = document.getElementById('runJobBtn');
  const statusEl = document.getElementById('jobStatus');
  const outputEl = document.getElementById('jobOutputContent');

  const applyBtn = document.getElementById('applyChangesBtn');
  const saveCommentBtn = document.getElementById('saveAsCommentBtn');
  const copyBtn = document.getElementById('copyOutputBtn');
  const regenBtn = document.getElementById('regenerateBtn');

  const agents = await loadAgents(state);
  populateAgentSelector(agents, agentSelector);

  jobSelector.addEventListener('change', () => {
    agentSelectorRow.style.display = jobSelector.value === 'agent' ? 'flex' : 'none';
  });

  runBtn.addEventListener('click', async () => {
    const job = jobSelector.value;
    const model = state.selectedModel?.id;
    const userInput = instructions.value.trim();
    const agentId = agentSelector.value;
    if (!model) { statusEl.textContent = 'Please select a model.'; return; }
    statusEl.textContent = 'Running job…';
    outputEl.textContent = '';
    const payload = buildPayload(job, model, userInput, agentId);
    try {
      const result = await runCopilotAction(payload);
      statusEl.textContent = `Status: ${result.status}`;
      outputEl.textContent = JSON.stringify(result, null, 2);
    } catch (err) {
      statusEl.textContent = 'Error running job.';
      outputEl.textContent = String(err);
    }
  });

  applyBtn.addEventListener('click', () => alert('Apply Changes: integrate with workspace update API.'));
  saveCommentBtn.addEventListener('click', () => alert('Save as Comment: integrate with comment system.'));
  copyBtn.addEventListener('click', async () => { await navigator.clipboard.writeText(outputEl.textContent); statusEl.textContent = 'Copied output.'; });
  regenBtn.addEventListener('click', () => runBtn.click());
}

async function loadAgents(state) {
  try {
    const res = await fetch('/api/agents');
    const agents = await res.json();
    state.agents = agents;
    return agents;
  } catch {
    return [{ id: 'agent-1', name: 'Build Agent' }, { id: 'agent-2', name: 'Test Agent' }, { id: 'agent-3', name: 'Deploy Agent' }];
  }
}

function populateAgentSelector(agents, selector) {
  selector.innerHTML = '<option value="">Select agent…</option>';
  agents.forEach(a => { const opt = document.createElement('option'); opt.value = a.id; opt.textContent = `${a.name} (${a.id})`; selector.appendChild(opt); });
}

function buildPayload(job, model, input, agentId) {
  const base = { model, input, context: { workspace: 'ai-shop-workspace', agent: agentId || null, task: null } };
  switch (job) {
    case 'workspace': return { ...base, action: 'workspace.rebuild.deploy', callback: 'workspace.deploy.report' };
    case 'agent': return { ...base, action: 'agent.invoke', callback: 'agent.invoke.report' };
    case 'tasks': return { ...base, action: 'agent.autocomplete.task', input: input || 'Each agent with assigned tasks should complete one task and return a callback report.', callback: 'agent.task.report' };
    default: return { ...base, action: 'unknown', callback: 'unknown.callback' };
  }
}
