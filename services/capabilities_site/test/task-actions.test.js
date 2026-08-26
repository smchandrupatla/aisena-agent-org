import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createActions, ACTION_DEFINITIONS } from '../modules/task-actions.js';

function fakeButton() {
  return { disabled: false, addEventListener() {} };
}

let originalFetch;
beforeEach(() => { originalFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = originalFetch; });

describe('task-actions module', () => {
  test('ACTION_DEFINITIONS has unique ids and non-empty labels', () => {
    const ids = ACTION_DEFINITIONS.map(a => a.id);
    assert.equal(new Set(ids).size, ids.length, 'action ids must be unique');
    for (const action of ACTION_DEFINITIONS) {
      assert.ok(action.label && action.label.length > 0, `${action.id} needs a label`);
    }
  });

  test('run() posts to /api/copilot/action with the selected model/action/instructions', async () => {
    let capturedBody;
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ action: 'generate_summary', model: { id: 'm1', name: 'M1' }, output: 'Summary text', timestamp: new Date().toISOString() }) };
    };

    const actions = createActions({
      getModel: () => ({ id: 'm1', name: 'M1' }),
      getTaskId: () => 'TASK-000001',
      getAgentKey: () => 'implementation-manager',
    });
    actions.init({
      actionSelect: { value: 'generate_summary', innerHTML: '' },
      instructionsInput: { value: '  extra context  ' },
      runButton: fakeButton(),
      applyButton: fakeButton(),
      saveCommentButton: fakeButton(),
      copyButton: fakeButton(),
      regenerateButton: fakeButton(),
      statusEl: { textContent: '' },
      outputEl: { textContent: '' },
    });

    await actions.run();

    assert.equal(capturedBody.task_id, 'TASK-000001');
    assert.equal(capturedBody.action, 'generate_summary');
    assert.equal(capturedBody.model, 'm1');
    assert.equal(capturedBody.instructions, 'extra context');
  });

  test('run() surfaces an error message when no model is selected', async () => {
    globalThis.fetch = async () => { throw new Error('should not be called'); };
    const statusEl = { textContent: '' };
    const actions = createActions({ getModel: () => null, getTaskId: () => 'TASK-1' });
    actions.init({
      actionSelect: { value: 'generate_summary', innerHTML: '' },
      instructionsInput: { value: '' },
      runButton: fakeButton(), applyButton: fakeButton(), saveCommentButton: fakeButton(),
      copyButton: fakeButton(), regenerateButton: fakeButton(),
      statusEl, outputEl: { textContent: '' },
    });

    await actions.run();
    assert.match(statusEl.textContent, /select a model/i);
  });

  test('applying a "description" action appends the output via onApplyDescription', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ action: 'generate_summary', model: { id: 'm1', name: 'M1' }, output: 'New summary', timestamp: new Date().toISOString() }) });

    let appliedText;
    let clickHandler;
    const actions = createActions({
      getModel: () => ({ id: 'm1', name: 'M1' }),
      getTaskId: () => 'TASK-1',
      onApplyDescription: (text) => { appliedText = text; },
    });
    actions.init({
      actionSelect: { value: 'generate_summary', innerHTML: '' },
      instructionsInput: { value: '' },
      runButton: fakeButton(),
      applyButton: { disabled: false, addEventListener(type, fn) { clickHandler = fn; } },
      saveCommentButton: fakeButton(),
      copyButton: fakeButton(), regenerateButton: fakeButton(),
      statusEl: { textContent: '' }, outputEl: { textContent: '' },
    });

    await actions.run();
    clickHandler();
    assert.equal(appliedText, 'New summary');
  });

  test('generate_subtasks output is parsed into individual titles for onApplySubtasks', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        action: 'generate_subtasks',
        model: { id: 'm1', name: 'M1' },
        output: '- Write tests\n* Fix bug\n1. Deploy',
        timestamp: new Date().toISOString(),
      }),
    });

    let appliedTitles;
    let clickHandler;
    const actions = createActions({
      getModel: () => ({ id: 'm1', name: 'M1' }),
      getTaskId: () => 'TASK-1',
      onApplySubtasks: (titles) => { appliedTitles = titles; },
    });
    actions.init({
      actionSelect: { value: 'generate_subtasks', innerHTML: '' },
      instructionsInput: { value: '' },
      runButton: fakeButton(),
      applyButton: { disabled: false, addEventListener(type, fn) { clickHandler = fn; } },
      saveCommentButton: fakeButton(), copyButton: fakeButton(), regenerateButton: fakeButton(),
      statusEl: { textContent: '' }, outputEl: { textContent: '' },
    });

    await actions.run();
    clickHandler();
    assert.deepEqual(appliedTitles, ['Write tests', 'Fix bug', 'Deploy']);
  });

  test('an action with no applyTarget cannot be applied and reports guidance instead', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ action: 'explain_task', model: { id: 'm1', name: 'M1' }, output: 'Explanation', timestamp: new Date().toISOString() }),
    });

    let applyCalled = false;
    let clickHandler;
    const statusEl = { textContent: '' };
    const actions = createActions({
      getModel: () => ({ id: 'm1', name: 'M1' }),
      getTaskId: () => 'TASK-1',
      onApplyDescription: () => { applyCalled = true; },
    });
    actions.init({
      actionSelect: { value: 'explain_task', innerHTML: '' },
      instructionsInput: { value: '' },
      runButton: fakeButton(),
      applyButton: { disabled: false, addEventListener(type, fn) { clickHandler = fn; } },
      saveCommentButton: fakeButton(), copyButton: fakeButton(), regenerateButton: fakeButton(),
      statusEl, outputEl: { textContent: '' },
    });

    await actions.run();
    clickHandler();
    assert.equal(applyCalled, false);
    assert.match(statusEl.textContent, /no field to apply/i);
  });
});
