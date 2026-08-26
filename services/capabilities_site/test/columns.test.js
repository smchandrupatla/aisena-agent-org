import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createColumns } from '../modules/columns.js';

// columns.js persists to localStorage; stub it so init()'s try/catch has a
// working (in-memory) store instead of just swallowing an error each time.
function installLocalStorageStub() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

describe('columns module', () => {
  test('all columns are visible by default', () => {
    installLocalStorageStub();
    const columns = createColumns({ storageKey: 'test-columns-1' });
    columns.init(['id', 'name', 'email'], null, null);
    assert.deepEqual(columns.getVisibleColumns(), ['id', 'name', 'email']);
    assert.deepEqual(columns.getHiddenColumns(), []);
  });

  test('setColumnVisibility hides and re-shows a column', () => {
    installLocalStorageStub();
    const columns = createColumns({ storageKey: 'test-columns-2' });
    columns.init(['id', 'name', 'email'], null, null);
    columns.setColumnVisibility('email', false);
    assert.deepEqual(columns.getVisibleColumns(), ['id', 'name']);
    assert.deepEqual(columns.getHiddenColumns(), ['email']);
    columns.setColumnVisibility('email', true);
    assert.deepEqual(columns.getVisibleColumns(), ['id', 'name', 'email']);
  });

  test('hideAll keeps the first (checkbox) column and showAll restores the rest', () => {
    installLocalStorageStub();
    const columns = createColumns({ storageKey: 'test-columns-3' });
    columns.init(['id', 'name', 'email'], null, null);
    columns.hideAll();
    assert.deepEqual(columns.getVisibleColumns(), ['id']);
    columns.showAll();
    assert.deepEqual(columns.getVisibleColumns(), ['id', 'name', 'email']);
  });

  test('column visibility persists across a re-init with the same storage key', () => {
    const store = installLocalStorageStub();
    const first = createColumns({ storageKey: 'shared-key' });
    first.init(['id', 'name'], null, null);
    first.setColumnVisibility('name', false);
    assert.ok(store.get('shared-key').includes('name'));

    const second = createColumns({ storageKey: 'shared-key' });
    second.init(['id', 'name'], null, null);
    assert.deepEqual(second.getVisibleColumns(), ['id']);
  });

  test('updateColumns drops hidden-state for columns that no longer exist', () => {
    installLocalStorageStub();
    const columns = createColumns({ storageKey: 'test-columns-4' });
    columns.init(['id', 'name', 'email'], null, null);
    columns.setColumnVisibility('email', false);
    columns.updateColumns(['id', 'name']);
    assert.deepEqual(columns.getHiddenColumns(), []);
  });

  test('onColumnsChange callback receives the updated visible column list', () => {
    installLocalStorageStub();
    const seen = [];
    const columns = createColumns({
      storageKey: 'test-columns-5',
      onColumnsChange: (visible) => seen.push(visible),
    });
    columns.init(['id', 'name'], null, null);
    columns.setColumnVisibility('name', false);
    assert.deepEqual(seen, [['id']]);
  });

  test('init/apply tolerate a missing table element without throwing', () => {
    installLocalStorageStub();
    const columns = createColumns({ storageKey: 'test-columns-6' });
    assert.doesNotThrow(() => columns.init(['id'], null, null));
    assert.doesNotThrow(() => columns.applyVisibility());
  });
});
