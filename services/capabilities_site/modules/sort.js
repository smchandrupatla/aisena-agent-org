/**
 * Sort Module - Handles column sorting with ascending/descending toggle
 * @module sort
 */

/**
 * Creates a sort handler
 * @param {Object} options - Configuration options
 * @param {Function} options.onSort - Callback when sort changes
 * @returns {Object} Sort controller with methods
 */
export function createSort(options = {}) {
  const { onSort } = options;
  let sortState = { column: null, direction: null };
  let headers = null;

  /**
   * Initialize sortable headers
   * @param {NodeListOf<HTMLTableHeaderCellElement>} headerElements - Table header cells
   * @param {Array<string>} columns - Column names
   */
  function init(headerElements, columns) {
    headers = headerElements;
    if (!headers || !headers.length) return;

    headers.forEach((header, index) => {
      const column = columns[index];
      if (!column) return;

      header.style.cursor = 'pointer';
      header.addEventListener('click', () => handleHeaderClick(column, header));
      header.setAttribute('role', 'columnheader');
      header.setAttribute('aria-sort', 'none');
    });
  }

  /**
   * Handle header click for sorting
   * @param {string} column - Column name
   * @param {HTMLTableHeaderCellElement} header - Header element
   */
  function handleHeaderClick(column, header) {
    if (sortState.column === column) {
      // Toggle direction
      sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending
      sortState.column = column;
      sortState.direction = 'asc';
    }

    updateHeaderIndicators();
    if (onSort) {
      onSort({ ...sortState });
    }
  }

  /**
   * Update header sort indicators
   */
  function updateHeaderIndicators() {
    if (!headers) return;

    headers.forEach((header, index) => {
      const column = header.dataset.column;
      if (!column) return;

      header.removeAttribute('aria-sort');
      const indicator = header.querySelector('.sort-indicator');
      if (indicator) indicator.remove();

      if (sortState.column === column) {
        header.setAttribute('aria-sort', sortState.direction === 'asc' ? 'ascending' : 'descending');
        const span = document.createElement('span');
        span.className = 'sort-indicator';
        span.textContent = sortState.direction === 'asc' ? ' ▲' : ' ▼';
        span.setAttribute('aria-hidden', 'true');
        header.appendChild(span);
      } else {
        header.setAttribute('aria-sort', 'none');
      }
    });
  }

  /**
   * Sort dataset based on current sort state
   * @param {Array<Object>} data - Dataset to sort
   * @returns {Array<Object>} Sorted dataset
   */
  function sort(data) {
    if (!sortState.column || !sortState.direction) return data;

    const { column, direction } = sortState;
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...data].sort((a, b) => {
      const valA = a[column];
      const valB = b[column];

      // Null/undefined values always sort to the end, regardless of direction
      if (valA === null || valA === undefined) return valB === null || valB === undefined ? 0 : 1;
      if (valB === null || valB === undefined) return -1;

      // Compare based on type
      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      } else {
        comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      }

      return comparison * multiplier;
    });
  }

  /**
   * Get current sort state
   * @returns {Object} Current sort state
   */
  function getSortState() {
    return { ...sortState };
  }

  /**
   * Set sort state programmatically
   * @param {string} column - Column name
   * @param {string} direction - Sort direction ('asc' or 'desc')
   */
  function setSortState(column, direction) {
    sortState.column = column;
    sortState.direction = direction;
    updateHeaderIndicators();
  }

  /**
   * Clear sort
   */
  function clearSort() {
    sortState = { column: null, direction: null };
    updateHeaderIndicators();
  }

  /**
   * Destroy sort handler
   */
  function destroy() {
    if (headers) {
      headers.forEach(header => {
        header.style.cursor = '';
        header.replaceWith(header.cloneNode(true));
      });
    }
  }

  return {
    init,
    sort,
    getSortState,
    setSortState,
    clearSort,
    destroy
  };
}