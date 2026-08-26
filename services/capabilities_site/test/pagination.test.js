import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createPagination } from '../modules/pagination.js';

describe('pagination module', () => {
  test('paginate slices data according to page and page size', () => {
    const pagination = createPagination({ defaultPageSize: 2 });
    const data = [1, 2, 3, 4, 5];
    pagination.setTotalItems(data.length);
    assert.deepEqual(pagination.paginate(data), [1, 2]);
  });

  test('setTotalItems computes totalPages and clamps current page', () => {
    const pagination = createPagination({ defaultPageSize: 10 });
    pagination.setTotalItems(25);
    assert.equal(pagination.getState().totalPages, 3);
    pagination.goToPage(3);
    pagination.setTotalItems(5); // shrinks below current page
    assert.equal(pagination.getState().page, 1);
  });

  test('totalPages is at least 1 even with zero items', () => {
    const pagination = createPagination();
    pagination.setTotalItems(0);
    assert.equal(pagination.getState().totalPages, 1);
  });

  test('goToPage ignores out-of-range pages', () => {
    const pagination = createPagination({ defaultPageSize: 10 });
    pagination.setTotalItems(20);
    pagination.goToPage(99);
    assert.equal(pagination.getState().page, 1);
    pagination.goToPage(0);
    assert.equal(pagination.getState().page, 1);
  });

  test('onPageChange and onPageSizeChange callbacks fire correctly', () => {
    const pageChanges = [];
    const sizeChanges = [];
    const pagination = createPagination({
      defaultPageSize: 10,
      onPageChange: (p) => pageChanges.push(p),
      onPageSizeChange: (s) => sizeChanges.push(s),
    });
    pagination.setTotalItems(30);
    pagination.goToPage(2);
    assert.deepEqual(pageChanges, [2]);
    assert.deepEqual(sizeChanges, []);
  });

  test('init tolerates missing DOM elements without throwing', () => {
    const pagination = createPagination();
    assert.doesNotThrow(() => pagination.init({}));
    assert.doesNotThrow(() => pagination.setTotalItems(10));
  });

  test('exposes updatePagination on its public API (used by main.js/task-subtasks.js/task-comments.js)', () => {
    const pagination = createPagination();
    assert.equal(typeof pagination.updatePagination, 'function');
    assert.doesNotThrow(() => pagination.updatePagination());
  });

  test('changing page size resets to page 1', () => {
    const pagination = createPagination({ defaultPageSize: 10 });
    pagination.setTotalItems(50);
    pagination.goToPage(4);
    let select;
    pagination.init({ pageSizeSelect: (select = { addEventListener(type, fn) { this._change = fn; }, innerHTML: '' }) });
    select._change({ target: { value: '25' } });
    assert.equal(pagination.getState().page, 1);
    assert.equal(pagination.getState().pageSize, 25);
  });
});
