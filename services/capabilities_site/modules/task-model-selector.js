/**
 * Task Model Selector - Fetches the available Copilot models and persists the
 * user's choice for the session.
 * @module task-model-selector
 */

const SESSION_KEY = 'task-copilot-model';

/**
 * Creates a model selector controller
 * @param {Object} options
 * @param {Function} [options.onModelChange] - Called with the selected model object
 * @returns {Object} Model selector controller
 */
export function createModelSelector(options = {}) {
  const { onModelChange } = options;
  let models = [];
  let selectedModel = null;
  let selectEl = null;
  let infoEl = null;

  async function init(selectElement, infoElement) {
    selectEl = selectElement;
    infoEl = infoElement;
    if (!selectEl) return;

    selectEl.innerHTML = '<option>Loading models…</option>';
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      models = Array.isArray(data.models) ? data.models : [];
    } catch (error) {
      console.error('Failed to load models:', error);
      models = [];
    }

    if (!models.length) {
      selectEl.innerHTML = '<option value="">No models available</option>';
      return;
    }

    selectEl.innerHTML = models.map(m =>
      `<option value="${m.id}">${m.name} — ${m.cost === 'free' ? 'Free' : 'Paid'} (${m.latency})</option>`
    ).join('');

    const stored = sessionStorage.getItem(SESSION_KEY);
    const initial = models.find(m => m.id === stored) || models.find(m => m.cost === 'free') || models[0];
    selectEl.value = initial.id;
    setSelected(initial);

    selectEl.addEventListener('change', () => {
      const model = models.find(m => m.id === selectEl.value);
      setSelected(model);
    });
  }

  function setSelected(model) {
    selectedModel = model || null;
    if (selectedModel) {
      sessionStorage.setItem(SESSION_KEY, selectedModel.id);
    }
    if (infoEl) {
      infoEl.textContent = selectedModel
        ? `${selectedModel.provider} · ${selectedModel.cost === 'free' ? 'Free' : 'Paid'} · ${selectedModel.latency} latency`
        : '';
    }
    if (onModelChange) onModelChange(selectedModel);
  }

  function getSelectedModel() {
    return selectedModel;
  }

  return { init, getSelectedModel };
}
