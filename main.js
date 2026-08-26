import { initModelSelector } from './modules/model-selector.js';
import { initJobExecution } from './modules/job-execution.js';

export const state = { models: [], selectedModel: null, agents: [] };

async function init() {
  await initModelSelector(state);
  await initJobExecution(state);
}

init();
