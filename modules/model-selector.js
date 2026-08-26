const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';

export async function initModelSelector(state) {
  const selector = document.getElementById('modelSelector');
  const info = document.getElementById('modelInfo');
  selector.innerHTML = '<option>Loading models…</option>';
  try {
    const res = await fetch(OPENROUTER_MODELS_ENDPOINT);
    const data = await res.json();
    const models = data.data || [];
    state.models = models;
    selector.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.id} (${m.pricing?.prompt || 'free'})`;
      selector.appendChild(opt);
    });
    selector.addEventListener('change', () => {
      const model = models.find(m => m.id === selector.value);
      state.selectedModel = model;
      info.textContent = model ? `${model.id} • ${model.pricing?.prompt ? 'Paid' : 'Free'}` : '';
    });
    if (models.length > 0) { selector.value = models[0].id; selector.dispatchEvent(new Event('change')); }
  } catch (err) {
    selector.innerHTML = '<option>Failed to load models</option>';
    console.error(err);
  }
}
