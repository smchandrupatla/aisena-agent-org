// Copilot Actions Module
// Wraps Copilot Action calls, formats payloads, handles callbacks,
// and returns structured results for job execution.

class CopilotActions {
  constructor() {
    this.apiBase = '/api/copilot-action';
    this.init();
  }

  init() {
    // Check for API base override
    if (window.API_BASE_OVERRIDE) {
      this.apiBase = window.API_BASE_OVERRIDE + '/copilot-action';
    }
  }

  /**
   * Builds the standard Copilot Action payload
   * @param {string} action - The action name
   * @param {string} model - The selected model ID
   * @param {string} input - User instructions
   * @param {object} context - Workspace/agent/task context
   * @param {string} callback - Callback name
   * @returns {object} The formatted payload
   */
  buildPayload(action, model, input, context = {}, callback) {
    return {
      model: model,
      action: action,
      input: input,
      context: context,
      callback: callback
    };
  }

  /**
   * Executes a Copilot Action with the given payload
   * @param {object} payload - The action payload
   * @returns {Promise<object>} The response from the API
   */
  async execute(payload) {
    try {
      const response = await fetch(this.apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Copilot Action execution failed:', error);
      throw error;
    }
  }

  /**
   * Executes a workspace rebuild and deploy job
   * @param {string} model - Selected model ID
   * @param {string} instructions - User instructions
   * @returns {Promise<object>} API response
   */
  async workspaceRebuildDeploy(model, instructions) {
    return this.execute(this.buildPayload(
      'workspace.rebuild.deploy',
      model,
      instructions,
      { workspace: window.workspaceId || 'current' },
      'workspace.deploy.report'
    ));
  }

  /**
   * Executes an agent invoke job
   * @param {string} model - Selected model ID
   * @param {string} agentId - Selected agent ID
   * @param {string} instructions - User instructions
   * @returns {Promise<object>} API response
   */
  async agentInvoke(model, agentId, instructions) {
    return this.execute(this.buildPayload(
      'agent.invoke',
      model,
      instructions,
      { 
        workspace: window.workspaceId || 'current',
        agent: agentId 
      },
      'agent.invoke.report'
    ));
  }

  /**
   * Executes an agent auto-complete task job
   * @param {string} model - Selected model ID
   * @param {string} instructions - User instructions (default: complete one task)
   * @returns {Promise<object>} API response
   */
  async agentAutocompleteTask(model, instructions = 'Complete one assigned task and return a callback report.') {
    return this.execute(this.buildPayload(
      'agent.autocomplete.task',
      model,
      instructions,
      { workspace: window.workspaceId || 'current' },
      'agent.task.report'
    ));
  }

  /**
   * Handles the API response from a Copilot Action
   * @param {object} result - The response object
   * @returns {object} Structured result with status, output, logs, and callback
   */
  handleResponse(result) {
    const structured = {
      status: result.status || 'failure',
      output: result.output || 'No output provided',
      logs: result.logs || [],
      callback: result.callback || null
    };

    return structured;
  }

  /**
   * Extracts and formats callback payload
   * @param {object} callback - The callback object from response
   * @returns {object} Formatted callback payload
   */
  formatCallback(callback) {
    if (!callback) return { name: 'none', payload: {} };

    return {
      name: callback.name || callback.callback || 'unknown',
      payload: callback.payload || {}
    };
  }
}

export default CopilotActions;