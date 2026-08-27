// Model Selector Module
// Fetches models from OpenRouter API, renders dropdown,
// persists selection, and provides selected model to all jobs.

class ModelSelector {
  constructor() {
    this.selectedModel = null;
    this.models = [];
    this.init();
  }

  init() {
    this.bindElements();
    this.loadModels();
  }

  bindElements() {
    this.modelSelector = document.getElementById('modelSelector');
    if (!this.modelSelector) {
      console.error('Model selector element not found');
      return;
    }
  }

  async loadModels() {
    try {
      const response = await fetch('/api/openrouter/models');
      if (!response.ok) throw new Error('Failed to fetch models from OpenRouter');
      
      this.models = await response.json();
      this.renderModels(this.models);
      this.persistSelection();
    } catch (error) {
      console.error('Error loading models from OpenRouter:', error);
      this.modelSelector.innerHTML = '<option value="">Error loading models</option>';
    }
  }

  renderModels(models) {
    const selector = document.getElementById('modelSelector');
    if (!selector) return;

    selector.innerHTML = '<option value="">Select a model...</option>';

    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.name} (${model.provider})`;
      
      // Store model metadata in data attributes
      option.dataset = {
        cost: model.pricing?.per_token || 0,
        latency: model.latency || 'unknown',
        capabilities: model.capabilities || [],
        type: model.type || 'unknown'
      };
      
      // Add tooltip with cost info
      option.title = `Cost: $${(model.pricing?.per_token || 0) per token}`;
      
      selector.appendChild(option);
    });

    // Restore previously selected model
    const savedModel = localStorage.getItem('selectedOpenRouterModel');
    if (savedModel) {
      selector.value = savedModel;
      this.onModelSelect(savedModel);
    }
  }

  onModelSelect(modelId) {
    this.selectedModel = modelId;
    localStorage.setItem('selectedOpenRouterModel', modelId);
    
    // Show model info tooltip
    const option = Array.from(document.querySelectorAll('#modelSelector option')).find(o => o.value === modelId);
    if (option) {
      const cost = option.dataset.cost || 0;
      const capabilities = option.dataset.capabilities || '';
      alert(`Selected model: ${option.textContent}\nCost per token: $${cost}\nCapabilities: ${capabilities}`);
    }
  }

  getSelectedModel() {
    return this.selectedModel;
  }

  getSelectedModelDetails() {
    const option = this.modelSelector.options[this.modelSelector.selectedIndex];
    if (!option || option.value === '') return null;

    return {
      id: option.value,
      name: option.textContent.split(' (')[0],
      provider: option.textContent.match(/\(([^)]+)\)/)?.[1] || 'unknown',
      cost: parseFloat(option.dataset.cost) || 0,
      latency: option.dataset.latency || 'unknown',
      capabilities: option.dataset.capabilities || []
    };
  }
}

export default ModelSelector;