/**
 * Columns Module - Handles column visibility toggles with localStorage persistence
 * @module columns
 */

/**
 * Creates a column visibility handler
 * @param {Object} options - Configuration options
 * @param {string} options.storageKey - localStorage key (default: 'postgres-viewer-columns')
 * @param {Function} options.onColumnsChange - Callback when columns change
 * @returns {Object} Columns controller with methods
 */
export function createColumns(options = {}) {
  const { 
    storageKey = 'postgres-viewer-columns',
    onColumnsChange 
  } = options;

  let allColumns = [];
  let hiddenColumns = new Set();
  let togglesContainer = null;
  let table = null;

  /**
   * Initialize columns
   * @param {Array<string>} columns - All column names
   * @param {HTMLElement} container - Container for toggle checkboxes
   * @param {HTMLTableElement} tableElement - Table element
   */
  function init(columns, container, tableElement) {
    allColumns = [...columns];
    table = tableElement;
    togglesContainer = container;

    // Load hidden columns from localStorage
    loadHiddenColumns();

    // Render toggles
    renderToggles();

    // Apply initial visibility
    applyVisibility();
  }

  /**
   * Load hidden columns from localStorage
   */
  function loadHiddenColumns() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          hiddenColumns = new Set(parsed.filter(col => allColumns.includes(col)));
        }
      }
    } catch (e) {
      console.warn('Failed to load column visibility from localStorage:', e);
    }
  }

  /**
   * Save hidden columns to localStorage
   */
  function saveHiddenColumns() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(hiddenColumns)));
    } catch (e) {
      console.warn('Failed to save column visibility to localStorage:', e);
    }
  }

  /**
   * Render column visibility toggles
   */
  function renderToggles() {
    if (!togglesContainer) return;

    togglesContainer.innerHTML = allColumns.map(column => {
      const isHidden = hiddenColumns.has(column);
      return `
        <label class="column-toggle" data-column="${escapeHtml(column)}">
          <input type="checkbox" ${!isHidden ? 'checked' : ''} aria-label="Show ${escapeHtml(column)} column">
          <span>${escapeHtml(column)}</span>
        </label>
      `;
    }).join('');

    // Add event listeners
    togglesContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', handleToggleChange);
    });
  }

  /**
   * Handle toggle change
   * @param {Event} event - Change event
   */
  function handleToggleChange(event) {
    const label = event.target.closest('.column-toggle');
    if (!label) return;

    const column = label.dataset.column;
    if (!column) return;

    if (event.target.checked) {
      hiddenColumns.delete(column);
    } else {
      hiddenColumns.add(column);
    }

    saveHiddenColumns();
    applyVisibility();
    
    if (onColumnsChange) {
      onColumnsChange(getVisibleColumns());
    }
  }

  /**
   * Apply column visibility to table
   */
  function applyVisibility() {
    if (!table) return;

    const visibleColumns = getVisibleColumns();
    const columnIndices = allColumns
      .map((col, index) => ({ col, index }))
      .filter(({ col }) => visibleColumns.includes(col))
      .map(({ index }) => index);

    // Update header cells
    const headerRow = table.querySelector('thead tr');
    if (headerRow) {
      headerRow.querySelectorAll('th').forEach((th, index) => {
        if (columnIndices.includes(index)) {
          th.style.display = '';
          th.removeAttribute('hidden');
        } else {
          th.style.display = 'none';
          th.setAttribute('hidden', '');
        }
      });
    }

    // Update body cells
    table.querySelectorAll('tbody tr').forEach(row => {
      row.querySelectorAll('td').forEach((td, index) => {
        if (columnIndices.includes(index)) {
          td.style.display = '';
          td.removeAttribute('hidden');
        } else {
          td.style.display = 'none';
          td.setAttribute('hidden', '');
        }
      });
    });

    // Update checkbox column (first column) - always visible
    const firstHeader = table.querySelector('thead th:first-child');
    const firstCells = table.querySelectorAll('tbody td:first-child');
    if (firstHeader) {
      firstHeader.style.display = '';
      firstHeader.removeAttribute('hidden');
    }
    firstCells.forEach(td => {
      td.style.display = '';
      td.removeAttribute('hidden');
    });
  }

  /**
   * Get visible columns
   * @returns {Array<string>} Visible column names
   */
  function getVisibleColumns() {
    return allColumns.filter(col => !hiddenColumns.has(col));
  }

  /**
   * Get hidden columns
   * @returns {Array<string>} Hidden column names
   */
  function getHiddenColumns() {
    return Array.from(hiddenColumns);
  }

  /**
   * Toggle column visibility
   * @param {string} column - Column name
   * @param {boolean} visible - Whether to show column
   */
  function setColumnVisibility(column, visible) {
    if (!allColumns.includes(column)) return;

    if (visible) {
      hiddenColumns.delete(column);
    } else {
      hiddenColumns.add(column);
    }

    saveHiddenColumns();
    applyVisibility();
    
    // Update checkbox
    const checkbox = togglesContainer?.querySelector(`[data-column="${escapeHtml(column)}"] input`);
    if (checkbox) {
      checkbox.checked = visible;
    }

    if (onColumnsChange) {
      onColumnsChange(getVisibleColumns());
    }
  }

  /**
   * Show all columns
   */
  function showAll() {
    hiddenColumns.clear();
    saveHiddenColumns();
    applyVisibility();
    
    togglesContainer?.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = true;
    });

    if (onColumnsChange) {
      onColumnsChange(getVisibleColumns());
    }
  }

  /**
   * Hide all columns (except first/checkbox column)
   */
  function hideAll() {
    allColumns.slice(1).forEach(col => hiddenColumns.add(col));
    saveHiddenColumns();
    applyVisibility();
    
    togglesContainer?.querySelectorAll('input[type="checkbox"]').forEach((checkbox, index) => {
      checkbox.checked = index === 0; // Keep first (checkbox) column visible
    });

    if (onColumnsChange) {
      onColumnsChange(getVisibleColumns());
    }
  }

  /**
   * Update columns (when data changes)
   * @param {Array<string>} columns - New column names
   */
  function updateColumns(columns) {
    allColumns = [...columns];
    // Keep only hidden columns that still exist
    hiddenColumns = new Set([...hiddenColumns].filter(col => allColumns.includes(col)));
    saveHiddenColumns();
    renderToggles();
    applyVisibility();
  }

  /**
   * Destroy columns handler
   */
  function destroy() {
    if (togglesContainer) {
      togglesContainer.innerHTML = '';
    }
  }

  return {
    init,
    getVisibleColumns,
    getHiddenColumns,
    setColumnVisibility,
    showAll,
    hideAll,
    updateColumns,
    applyVisibility,
    destroy
  };
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}