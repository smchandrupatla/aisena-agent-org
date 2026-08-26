/**
 * Task Comments - Renders the comment thread with search/sort/pagination.
 * @module task-comments
 */

import { createSearch } from './search.js';
import { createSort } from './sort.js';
import { createPagination } from './pagination.js';

/**
 * Creates a comments controller
 * @param {Object} options
 * @param {Function} options.formatTimestamp - Formats an ISO timestamp for display
 * @returns {Object} Comments controller
 */
export function createComments(options = {}) {
  const { formatTimestamp = (t) => t } = options;
  const columns = ['author', 'text'];

  let comments = [];
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
    pagination.init({
      container: elements.paginationContainer,
      prevButton: elements.prevButton,
      nextButton: elements.nextButton,
      pageInfo: elements.pageInfo,
      pageSizeSelect: elements.pageSizeSelect,
    });
    elements.sortSelect?.addEventListener('change', () => {
      const [column, direction] = (elements.sortSelect.value || 'timestamp:desc').split(':');
      sort.setSortState(column, direction);
      render();
    });
    sort.setSortState('timestamp', 'desc');
  }

  function setData(newComments) {
    comments = Array.isArray(newComments) ? newComments : [];
    render();
  }

  function render() {
    if (!elements.list) return;

    let data = search.filter(comments, columns);
    data = sort.sort(data);
    pagination.setTotalItems(data.length);
    const pageData = pagination.paginate(data);

    if (!comments.length) {
      elements.list.innerHTML = `<p class="empty-state-cell">No comments yet. Be the first to add one.</p>`;
    } else if (!pageData.length) {
      elements.list.innerHTML = `<p class="empty-state-cell">No results found</p>`;
    } else {
      elements.list.innerHTML = pageData.map(c => `
        <div class="comment-entry">
          <div class="comment-meta">
            <span>${escapeHtml(c.author || 'User')}</span>
            <span>${escapeHtml(formatTimestamp(c.timestamp))}</span>
            <button type="button" class="ghost comment-copy-btn" data-text="${escapeHtml(c.text)}">Copy</button>
          </div>
          <p>${escapeHtml(c.text)}</p>
        </div>
      `).join('');

      elements.list.querySelectorAll('.comment-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await navigator.clipboard.writeText(btn.dataset.text);
          btn.textContent = 'Copied';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
        });
      });
    }

    pagination.updatePagination();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { init, setData };
}
