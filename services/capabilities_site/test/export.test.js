import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createExport } from '../modules/export.js';

describe('export module', () => {
  test('toCsv produces a header row plus one row per record', () => {
    const exp = createExport();
    const csv = exp.toCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }], ['a', 'b']);
    assert.equal(csv, 'a,b\n1,x\n2,y');
  });

  test('toCsv escapes commas, quotes, and newlines per RFC 4180', () => {
    const exp = createExport();
    assert.equal(exp.toCsv([{ note: 'has, comma' }], ['note']), 'note\n"has, comma"');
    assert.equal(exp.toCsv([{ note: 'has "quote"' }], ['note']), 'note\n"has ""quote"""');
    assert.equal(exp.toCsv([{ note: 'line\nbreak' }], ['note']), 'note\n"line\nbreak"');
  });

  test('toCsv renders null/undefined as empty cells', () => {
    const exp = createExport();
    const csv = exp.toCsv([{ a: null, b: undefined }], ['a', 'b']);
    assert.equal(csv, 'a,b\n,');
  });

  test('toCsv returns an empty string for an empty dataset', () => {
    const exp = createExport();
    assert.equal(exp.toCsv([], ['a']), '');
  });

  test('toJson pretty-prints the full row objects', () => {
    const exp = createExport();
    const json = exp.toJson([{ a: 1 }]);
    assert.deepEqual(JSON.parse(json), [{ a: 1 }]);
    assert.ok(json.includes('\n'), 'expected pretty-printed (indented) JSON');
  });
});
