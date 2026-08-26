/**
 * Task Copilot Actions - Defines the available Copilot Actions, runs them
 * against the backend, and applies results back onto the task.
 * @module task-actions
 */

export const ACTION_DEFINITIONS = [
  { id: 'generate_summary', label: 'Generate Task Summary', applyTarget: 'description' },
  { id: 'generate_acceptance_criteria', label: 'Generate Acceptance Criteria', applyTarget: 'description' },
  { id: 'generate_subtasks', label: 'Generate Subtasks', applyTarget: 'subtasks' },
  { id: 'explain_task', label: 'Explain Task', applyTarget: null },
  { id: 'suggest_next_steps', label: 'Suggest Next Steps', applyTarget: 'next_checkpoint' },
  { id: 'generate_code_snippet', label: 'Generate Code Snippet', applyTarget: null },
  { id: 'generate_test_cases', label: 'Generate Test Cases', applyTarget: null },
  { id: 'generate_documentation', label: 'Generate Documentation', applyTarget: null },
  { id: 'convert_to_story', label: 'Convert Task to Story', applyTarget: 'description' },
  { id: 'convert_to_bug', label: 'Convert Task to Bug', applyTarget: 'description' },
  { id: 'convert_to_epic', label: 'Convert Task to Epic', applyTarget: 'description' },
];

/**
 * Creates a Copilot Actions controller
 * @param {Object} options
 * @param {Function} options.getModel - Returns the currently selected model object
 * @param {Function} options.getTaskId - Returns the current task id
 * @param {Function} options.getAgentKey - Returns the agent key to run the action as
 * @param {Function} options.onApplyDescription - Called with text to append to the description
 * @param {Function} options.onApplyNextCheckpoint - Called with text to set as the next checkpoint
 * @param {Function} options.onApplySubtasks - Called with an array of subtask titles
 * @param {Function} options.onSaveAsComment - Called with text to post as a comment
 * @returns {Object} Actions controller
 */
export function createActions(options = {}) {
  const {
    getModel, getTaskId, getAgentKey,
    onApplyDescription, onApplyNextCheckpoint, onApplySubtasks, onSaveAsComment
  } = options;

  let elements = {};
  let lastResult = null;

  function init(els) {
    elements = els;
    if (elements.actionSelect) {
      elements.actionSelect.innerHTML = ACTION_DEFINITIONS
        .map(a => `<option value="${a.id}">${a.label}</option>`)
        .join('');
    }
    elements.runButton?.addEventListener('click', run);
    elements.applyButton?.addEventListener('click', applyResult);
    elements.saveCommentButton?.addEventListener('click', saveAsComment);
    elements.copyButton?.addEventListener('click', copyOutput);
    elements.regenerateButton?.addEventListener('click', run);
  }

  async function run() {
    const action = elements.actionSelect?.value;
    const model = getModel?.();
    const taskId = getTaskId?.();
    const instructions = elements.instructionsInput?.value.trim() || '';

    if (!action) return;
    if (!model) {
      setStatus('Please select a model.');
      return;
    }

    setStatus('Running action…');
    setOutput('');
    setButtonsEnabled(false);

    try {
      const response = await fetch('/api/copilot/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          action,
          model: model.id,
          instructions,
          agent: getAgentKey?.(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Action failed');

      lastResult = result;
      setOutput(result.output);
      setStatus(`Done · ${result.model?.name || model.name} · ${new Date(result.timestamp).toLocaleTimeString()}`);
      setButtonsEnabled(true);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  }

  function applyResult() {
    if (!lastResult) return;
    const definition = ACTION_DEFINITIONS.find(a => a.id === lastResult.action);
    const target = definition?.applyTarget;

    if (target === 'description') {
      onApplyDescription?.(lastResult.output);
    } else if (target === 'next_checkpoint') {
      onApplyNextCheckpoint?.(lastResult.output);
    } else if (target === 'subtasks') {
      const titles = lastResult.output
        .split('\n')
        .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
        .filter(Boolean);
      onApplySubtasks?.(titles);
    } else {
      setStatus('This action has no field to apply to. Use "Save as comment" instead.');
      return;
    }
    setStatus('Applied to task.');
  }

  function saveAsComment() {
    if (!lastResult) return;
    onSaveAsComment?.(lastResult.output);
  }

  async function copyOutput() {
    if (!lastResult) return;
    try {
      await navigator.clipboard.writeText(lastResult.output);
      setStatus('Copied output to clipboard.');
    } catch {
      setStatus('Could not copy to clipboard.');
    }
  }

  function setStatus(text) {
    if (elements.statusEl) elements.statusEl.textContent = text;
  }

  function setOutput(text) {
    if (elements.outputEl) elements.outputEl.textContent = text;
  }

  function setButtonsEnabled(enabled) {
    [elements.applyButton, elements.saveCommentButton, elements.copyButton, elements.regenerateButton]
      .forEach(btn => { if (btn) btn.disabled = !enabled; });
  }

  return { init, run };
}
