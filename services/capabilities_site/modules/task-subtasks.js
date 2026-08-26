/**
 * Task Subtasks - Renders the subtask table with search/sort/pagination and
 * bulk select/complete/delete, persisting changes via PUT /api/tasks/:id/subtasks.
 * @module task-subtasks
 */

import { createSearch } from './search.js';
import { createSort } from './sort.js';
import { createPagination } from './pagination.js';

/**
 * Creates a subtasks controller
 * @param {Object} options
 * @param {Function} options.getTaskId - Returns the current task id
 * @param {Function} options.onChanged - Called with the updated task after a persist
 * @returns {Object} Subtasks controller
 */
export function createSubtasks(options = {}) {
  const { getTaskId, onChanged } = options;
  const columns = ['title', 'done'];

  let subtasks = [];
  let selected = new Set();
  let elements = {};

  const search = createSearch({ debounceMs: 250, onSearch: () => render() });
  const sort = createSort({ onSort: () => render() });
  const pagination = createPagination({
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    onPageChange: () => render(),
    onPageSizeChange: () => render(),
  });

  function init(els) {
    elements = els;
    search.init(elements.searchInput);
    const headers = elements.tbody?.closest('table')?.querySelectorAll('thead th');
    if (headers) {
      sort.init(headers, [null, 'title', 'done', null]);
    }
    pagination.init({
      container: elements.paginationContainer,
      prevButton: elements.prevButton,
      nextButton: elements.nextButton,
      pageInfo: elements.pageInfo,
      pageSizeSelect: elements.pageSizeSelect,
    });

    elements.selectAllCheckbox?.addEventListener('change', (event) => {
      getVisibleData().forEach(s => toggleSelected(s.id, event.target.checked));
      render();
    });
    elements.bulkCompleteButton?.addEventListener('click', () => bulkUpdate(true));
    elements.bulkDeleteButton?.addEventListener('click', bulkDelete);
    elements.addForm?.addEventListener('submit', handleAdd);
  }

  function setData(newSubtasks) {
    subtasks = Array.isArray(newSubtasks) ? newSubtasks : [];
    selected = new Set([...selected].filter(id => subtasks.some(s => s.id === id)));
    render();
  }

  function getVisibleData() {
    let data = search.filter(subtasks, columns);
    data = sort.sort(data);
    pagination.setTotalItems(data.length);
    return pagination.paginate(data);
  }

  function toggleSelected(id, checked) {
    if (checked) selected.add(id); else selected.delete(id);
  }

  function render() {
    if (!elements.tbody) return;
    const pageData = getVisibleData();

    if (!subtasks.length) {
      elements.tbody.innerHTML = `<tr><td colspan="3" class="empty-state-cell">No subtasks yet</td></tr>`;
    } else if (!pageData.length) {
      elements.tbody.innerHTML = `<tr><td colspan="3" class="empty-state-cell">No results found</td></tr>`;
    } else {
      elements.tbody.innerHTML = pageData.map(s => `
        <tr data-id="${s.id}" class="${selected.has(s.id) ? 'selected' : ''}">
          <td><input type="checkbox" class="subtask-checkbox" data-id="${s.id}" ${selected.has(s.id) ? 'checked' : ''} aria-label="Select subtask"></td>
          <td class="${s.done ? 'subtask-done' : ''}">${escapeHtml(s.title)}</td>
          <td>
            <button type="button" class="ghost subtask-toggle-btn" data-id="${s.id}">${s.done ? 'Mark not done' : 'Mark done'}</button>
            <button type="button" class="ghost subtask-delete-btn" data-id="${s.id}">Delete</button>
          </td>
        </tr>
      `).join('');

      elements.tbody.querySelectorAll('.subtask-checkbox').forEach(cb => {
        cb.addEventListener('change', () => { toggleSelected(cb.dataset.id, cb.checked); render(); });
      });
      elements.tbody.querySelectorAll('.subtask-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleDone(btn.dataset.id));
      });
      elements.tbody.querySelectorAll('.subtask-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteOne(btn.dataset.id));
      });
    }

    pagination.updatePagination();
    if (elements.selectionSummary) {
      elements.selectionSummary.textContent = selected.size ? `${selected.size} selected` : '';
      elements.selectionSummary.hidden = selected.size === 0;
    }
  }

  async function persist(nextSubtasks) {
    const taskId = getTaskId?.();
    if (!taskId) return;
    const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/subtasks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks: nextSubtasks, actor: 'user' }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to update subtasks');
    setData(result.task.subtasks || []);
    onChanged?.(result.task);
  }

  async function handleAdd(event) {
    event.preventDefault();
    const input = elements.addInput;
    const title = input?.value.trim();
    if (!title) return;
    const taskId = getTaskId?.();
    if (!taskId) return;
    const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, actor: 'user' }),
    });
    const result = await response.json();
    if (response.ok) {
      setData(result.task.subtasks || []);
      onChanged?.(result.task);
      input.value = '';
    }
  }

  async function addMany(titles) {
    if (!titles?.length) return;
    const next = [...subtasks, ...titles.map(title => ({
      id: `sub-${Math.random().toString(36).slice(2, 10)}`,
      title,
      done: false,
      created_at: new Date().toISOString(),
    }))];
    await persist(next);
  }

  async function toggleDone(id) {
    const next = subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s);
    await persist(next);
  }

  async function deleteOne(id) {
    const next = subtasks.filter(s => s.id !== id);
    selected.delete(id);
    await persist(next);
  }

  async function bulkUpdate(done) {
    if (!selected.size) return;
    const next = subtasks.map(s => selected.has(s.id) ? { ...s, done } : s);
    await persist(next);
  }

  async function bulkDelete() {
    if (!selected.size) return;
    const next = subtasks.filter(s => !selected.has(s.id));
    selected.clear();
    await persist(next);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { init, setData, addMany };
}
