/**
 * Pagination Module - Handles pagination with page numbers, prev/next, page size selector
 * @module pagination
 */

/**
 * Creates a pagination handler
 * @param {Object} options - Configuration options
 * @param {number} options.defaultPageSize - Default page size (default: 25)
 * @param {Array<number>} options.pageSizeOptions - Available page sizes (default: [10, 25, 50, 100])
 * @param {Function} options.onPageChange - Callback when page changes
 * @param {Function} options.onPageSizeChange - Callback when page size changes
 * @returns {Object} Pagination controller with methods
 */
export function createPagination(options = {}) {
  const { 
    defaultPageSize = 25, 
    pageSizeOptions = [10, 25, 50, 100],
    onPageChange,
    onPageSizeChange
  } = options;

  let state = {
    page: 1,
    pageSize: defaultPageSize,
    totalItems: 0,
    totalPages: 0
  };

  let elements = {
    container: null,
    prevButton: null,
    nextButton: null,
    pageInfo: null,
    pageSizeSelect: null
  };

  /**
   * Initialize pagination controls
   * @param {Object} containerElements - DOM elements for pagination
   */
  function init(containerElements) {
    elements = { ...elements, ...containerElements };
    
    if (elements.prevButton) {
      elements.prevButton.addEventListener('click', () => goToPage(state.page - 1));
    }
    if (elements.nextButton) {
      elements.nextButton.addEventListener('click', () => goToPage(state.page + 1));
    }
    if (elements.pageSizeSelect) {
      // Populate page size options
      elements.pageSizeSelect.innerHTML = pageSizeOptions
        .map(size => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size} per page</option>`)
        .join('');
      elements.pageSizeSelect.addEventListener('change', handlePageSizeChange);
    }
  }

  /**
   * Handle page size change
   * @param {Event} event - Change event
   */
  function handlePageSizeChange(event) {
    const newSize = parseInt(event.target.value, 10);
    state.pageSize = newSize;
    state.page = 1; // Reset to first page
    updatePagination();
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    }
    if (onPageChange) {
      onPageChange(state.page);
    }
  }

  /**
   * Go to specific page
   * @param {number} page - Page number
   */
  function goToPage(page) {
    if (page < 1 || page > state.totalPages) return;
    state.page = page;
    updatePagination();
    if (onPageChange) {
      onPageChange(page);
    }
  }

  /**
   * Update pagination state based on total items
   * @param {number} totalItems - Total number of items
   */
  function setTotalItems(totalItems) {
    state.totalItems = totalItems;
    state.totalPages = Math.ceil(totalItems / state.pageSize) || 1;
    if (state.page > state.totalPages) {
      state.page = state.totalPages;
    }
    updatePagination();
  }

  /**
   * Update pagination UI
   */
  function updatePagination() {
    if (!elements.container) return;

    const { page, totalPages, pageSize, totalItems } = state;
    const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    // Update page info
    if (elements.pageInfo) {
      elements.pageInfo.textContent = `Page ${page} of ${totalPages} (${startItem}–${endItem} of ${totalItems})`;
    }

    // Update prev/next buttons
    if (elements.prevButton) {
      elements.prevButton.disabled = page <= 1;
      elements.prevButton.setAttribute('aria-disabled', page <= 1);
    }
    if (elements.nextButton) {
      elements.nextButton.disabled = page >= totalPages;
      elements.nextButton.setAttribute('aria-disabled', page >= totalPages);
    }

    // Update page size select
    if (elements.pageSizeSelect) {
      elements.pageSizeSelect.value = pageSize;
    }
  }

  /**
   * Slice dataset for current page
   * @param {Array} data - Full dataset
   * @returns {Array} Paginated dataset
   */
  function paginate(data) {
    const { page, pageSize } = state;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }

  /**
   * Get current pagination state
   * @returns {Object} Current pagination state
   */
  function getState() {
    return { ...state };
  }

  /**
   * Reset to first page
   */
  function reset() {
    state.page = 1;
    updatePagination();
  }

  /**
   * Destroy pagination handler
   */
  function destroy() {
    if (elements.prevButton) {
      elements.prevButton.replaceWith(elements.prevButton.cloneNode(true));
    }
    if (elements.nextButton) {
      elements.nextButton.replaceWith(elements.nextButton.cloneNode(true));
    }
    if (elements.pageSizeSelect) {
      elements.pageSizeSelect.replaceWith(elements.pageSizeSelect.cloneNode(true));
    }
  }

  return {
    init,
    setTotalItems,
    paginate,
    goToPage,
    getState,
    updatePagination,
    reset,
    destroy
  };
}