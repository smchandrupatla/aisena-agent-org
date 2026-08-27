// Job Execution Module
// Handles rendering the Job Execution section, job selection,
// user instructions, triggering Copilot Actions, and rendering output.

class JobExecution {
  constructor() {
    this.model = null;
    this.job = null;
    this.instructions = '';
    this.init();
  }

  init() {
    this.bindElements();
    this.loadModels();
    this.setupEventListeners();
  }

  bindElements() {
    this.modelSelector = document.getElementById('modelSelector');
    this.jobSelector = document.getElementById('jobSelector');
    this.jobInstructions = document.getElementById('jobInstructions');
    this.runJobBtn = document.getElementById('runJobBtn');
    this.jobOutput = document.getElementById('jobOutput');
    this.applyChangesBtn = document.getElementById('applyChangesBtn');
    this.copyOutputBtn = document.getElementById('copyOutputBtn');
    this.regenerateBtn = document.getElementById('regenerateBtn');
  }

  async loadModels() {
    try {
      const response = await fetch('/api/openrouter/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      
      const models = await response.json();
      this.renderModels(models);
    } catch (error) {
      console.error('Error loading models:', error);
      this.modelSelector.innerHTML = '<option value="">Error loading models</option>';
    }
  }

  renderModels(models) {
    this.modelSelector.innerHTML = '<option value="">Select a model...</option>';
    
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.name} (${model.provider})`;
      option.dataset = {
        cost: model.pricing?.per_token || 0,
        latency: model.latency || 'unknown',
        capabilities: model.capabilities || []
      };
      this.modelSelector.appendChild(option);
    });
  }

  setupEventListeners() {
    this.jobSelector.addEventListener('change', (e) => {
      this.job = e.target.value;
    });

    this.modelSelector.addEventListener('change', (e) => {
      this.model = e.target.value;
    });

    this.runJobBtn.addEventListener('click', () => this.runJob());

    this.applyChangesBtn.addEventListener('click', () => this.applyChanges());
    this.copyOutputBtn.addEventListener('click', () => this.copyOutput());
    this.regenerateBtn.addEventListener('click', () => this.regenerate());
  }

  async runJob() {
    if (!this.model || !this.job) {
      alert('Please select a model and job first.');
      return;
    }

    const instructions = this.jobInstructions.value.trim();
    if (!instructions) {
      alert('Please enter instructions for the job.');
      return;
    }

    this.showOutput(true, 'Running job...');

    try {
      const payload = {
        model: this.model,
        action: this.job,
        input: instructions,
        context: {
          workspace: window.workspaceId || 'current',
          agent: this.job === 'agent.invoke' ? this.getSelectedAgent() : null,
          task: this.job === 'agent.autocomplete.task' ? this.getSelectedTask() : null
        },
        callback: `${this.job}.report`
      };

      const response = await fetch('/api/copilock-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      this.handleJobResult(result);
    } catch (error) {
      console.error('Error running job:', error);
      this.showOutput(false, `Error: ${error.message}`);
    }
  }

  getSelectedAgent() {
    // Placeholder - would integrate with agent registry
    return null;
  }

  getSelectedTask() {
    // Placeholder - would integrate with task system
    return null;
  }

  showOutput(isLoading, message) {
    this.jobOutput.style.display = 'block';
    this.jobOutput.innerHTML = `
      <h4>Output</h4>
      ${isLoading ? '<p>Running job...</p>' : `<p>${message}</p>`}
    `;
  }

  handleJobResult(result) {
    if (result.status === 'success') {
      this.showOutput(false, result.output || 'Job completed successfully');
      this.renderCallback(result.callback);
    } else {
      this.showOutput(false, `Failed: ${result.output || 'Unknown error'}`);
      this.renderLogs(result.logs || []);
    }

    this.applyChangesBtn.style.display = 'inline-block';
    this.copyOutputBtn.style.display = 'inline-block';
    this.regenerateBtn.style.display = 'inline-block';
  }

  renderCallback(callback) {
    this.jobOutput.innerHTML += `
      <div style="margin-top: 16px; padding: 12px; background: #f0f4f8; border-radius: var(--radius-md);">
        <strong>Callback:</strong> ${callback.name || 'unknown'}</div>`;
  }

  renderLogs(logs) {
    if (logs.length === 0) {
      this.jobOutput.innerHTML += '<p>No logs available.</p>';
      return;
    }

    const logList = logs.map(log => `<li>${log}</li>`).join('');
    this.jobOutput.innerHTML += `<ul>${logList}</ul>`;
  }

  async applyChanges() {
    // Placeholder - would apply changes to workspace
    this.showOutput(true, 'Applying changes...');
    setTimeout(() => {
      this.showOutput(false, 'Changes applied successfully.');
      this.applyChangesBtn.style.display = 'none';
      this.copyOutputBtn.style.display = 'none';
      this.regenerateBtn.style.display = 'none';
    }, 1000);
  }

  copyOutput() {
    const output = this.jobOutput.innerText;
    navigator.clipboard.writeText(output).then(() => {
      alert('Output copied to clipboard!');
    });
  }

  async regenerate() {
    // Would re-run the job with same parameters
    if (this.model && this.job) {
      this.runJob();
    }
  }
}

export default JobExecution;