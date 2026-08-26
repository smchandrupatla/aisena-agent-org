import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createSearch } from '../modules/search.js';
import { installDomStub } from './helpers/dom-stub.js';

installDomStub();

const rows = [
  { name: 'Alpha', city: 'Sydney' },
  { name: 'Beta', city: 'Melbourne' },
  { name: 'Gamma', city: 'sydney' },
  { name: null, city: 'Perth' },
];

describe('search module', () => {
  test('filter returns all rows when no term is set', () => {
    const search = createSearch();
    assert.deepEqual(search.filter(rows, ['name', 'city']), rows);
  });

  test('filter matches case-insensitively across multiple columns', () => {
    const search = createSearch();
    search.setSearchTerm('sydney');
    const result = search.filter(rows, ['name', 'city']);
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(r => r.city), ['Sydney', 'sydney']);
  });

  test('filter tolerates null/undefined column values without throwing', () => {
    const search = createSearch();
    search.setSearchTerm('perth');
    const result = search.filter(rows, ['name', 'city']);
    assert.equal(result.length, 1);
    assert.equal(result[0].city, 'Perth');
  });

  test('clearSearch resets the term and notifies onSearch', () => {
    let notified;
    const search = createSearch({ onSearch: (term) => { notified = term; } });
    search.setSearchTerm('alpha');
    search.clearSearch();
    assert.equal(search.getSearchTerm(), '');
    assert.equal(notified, '');
  });

  test('highlight wraps matches in a <mark> tag and escapes HTML', () => {
    const search = createSearch();
    search.setSearchTerm('script');
    const highlighted = search.highlight('<script>alert(1)</script>');
    assert.ok(highlighted.includes('<mark class="search-highlight">script</mark>'));
    assert.ok(!highlighted.includes('<script>alert'));
  });

  test('highlight is a no-op when there is no search term', () => {
    const search = createSearch();
    assert.equal(search.highlight('plain text'), 'plain text');
  });

  test('highlight escapes double/single quotes (regression: raw quotes corrupt HTML attributes when this text is reused as data-* values)', () => {
    const search = createSearch();
    search.setSearchTerm('xyz');
    const highlighted = search.highlight(`He said "hello" and 'bye' xyz`);
    assert.ok(highlighted.includes('&quot;hello&quot;'), 'double quotes in user text must be escaped');
    assert.ok(highlighted.includes('&#39;bye&#39;'), 'single quotes in user text must be escaped');
    assert.ok(!highlighted.includes('"hello"'), 'raw double quotes must not survive escaping');
    assert.ok(!highlighted.includes("'bye'"), 'raw single quotes must not survive escaping');
  });

  test('debounces input before invoking onSearch', (t, done) => {
    let calls = 0;
    const search = createSearch({ debounceMs: 10, onSearch: () => { calls += 1; } });
    let handler;
    search.init({ addEventListener: (type, fn) => { if (type === 'input') handler = fn; } });
    handler({ target: { value: 'a' } });
    handler({ target: { value: 'ab' } });
    handler({ target: { value: 'abc' } });
    setTimeout(() => {
      assert.equal(calls, 1, 'rapid input should collapse into a single debounced call');
      assert.equal(search.getSearchTerm(), 'abc');
      done();
    }, 40);
  });
});
