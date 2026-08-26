import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createSort } from '../modules/sort.js';
import { installDomStub } from './helpers/dom-stub.js';

installDomStub();

describe('sort module', () => {
  test('returns the original data untouched when no sort is set', () => {
    const sort = createSort();
    const data = [{ n: 2 }, { n: 1 }];
    assert.deepEqual(sort.sort(data), data);
  });

  test('sorts numbers ascending and descending', () => {
    const sort = createSort();
    const data = [{ n: 3 }, { n: 1 }, { n: 2 }];
    sort.setSortState('n', 'asc');
    assert.deepEqual(sort.sort(data).map(r => r.n), [1, 2, 3]);
    sort.setSortState('n', 'desc');
    assert.deepEqual(sort.sort(data).map(r => r.n), [3, 2, 1]);
  });

  test('sorts strings case-insensitively', () => {
    const sort = createSort();
    const data = [{ name: 'banana' }, { name: 'Apple' }, { name: 'cherry' }];
    sort.setSortState('name', 'asc');
    assert.deepEqual(sort.sort(data).map(r => r.name), ['Apple', 'banana', 'cherry']);
  });

  test('sorts ISO date strings chronologically', () => {
    const sort = createSort();
    const data = [
      { ts: '2026-08-20T00:00:00Z' },
      { ts: '2026-08-25T00:00:00Z' },
      { ts: '2026-08-01T00:00:00Z' },
    ];
    sort.setSortState('ts', 'asc');
    assert.deepEqual(sort.sort(data).map(r => r.ts), [
      '2026-08-01T00:00:00Z', '2026-08-20T00:00:00Z', '2026-08-25T00:00:00Z',
    ]);
  });

  test('places null/undefined values at the end regardless of direction', () => {
    const sort = createSort();
    const data = [{ n: 1 }, { n: null }, { n: 2 }, { n: undefined }];
    sort.setSortState('n', 'asc');
    assert.deepEqual(sort.sort(data).map(r => r.n), [1, 2, null, undefined]);
    sort.setSortState('n', 'desc');
    assert.deepEqual(sort.sort(data).map(r => r.n), [2, 1, null, undefined]);
  });

  test('does not mutate the input array', () => {
    const sort = createSort();
    const data = [{ n: 2 }, { n: 1 }];
    sort.setSortState('n', 'asc');
    sort.sort(data);
    assert.deepEqual(data.map(r => r.n), [2, 1]);
  });

  test('clicking the same header twice toggles direction', () => {
    let lastSort;
    const sort = createSort({ onSort: (s) => { lastSort = { ...s }; } });
    const header = { style: {}, setAttribute() {}, removeAttribute() {}, appendChild() {}, querySelector() { return null; } };
    let clickHandler;
    sort.init([{ ...header, addEventListener: (type, fn) => { clickHandler = fn; }, dataset: { column: 'title' } }], ['title']);
    clickHandler();
    assert.deepEqual(lastSort, { column: 'title', direction: 'asc' });
    clickHandler();
    assert.deepEqual(lastSort, { column: 'title', direction: 'desc' });
  });
});
