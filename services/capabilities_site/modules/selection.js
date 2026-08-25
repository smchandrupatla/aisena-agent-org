/**
 * Selection Module - Handles row selection with checkboxes, select all, and persistence across pages
 * @module selection
 */

/**
 * Creates a selection handler
 * @param {Object} options - Configuration options
 * @param {Function} options.onSelectionChange - Callback when selection changes
 * @returns {Object} Selection controller with methods
 */
export function createSelection(options = {}) {
  const { onSelectionChange } = options;
  let selectedRows = new Set(); // Store unique row identifiers
  let selectAllCheckbox = null;
  let rowCheckboxes = new Map(); // Map of rowId -> checkbox element
  let getRowId = (row) => JSON.stringify(row); // Default row ID function

  /**
   * Initialize selection with row ID function
   * @param {Function} rowIdFn - Function to get unique ID from row
   */
  function init(rowIdFn) {
    if (typeof rowIdFn === 'function') {
      getRowId = rowIdFn;
    }
  }

  /**
   * Register row checkbox
   * @param {Object} row - Row data
   * @param {HTMLInputElement} checkbox - Checkbox element
   */
  function registerRowCheckbox(row, checkbox) {
    const rowId = getRowId(row);
    rowCheckboxes.set(rowId, checkbox);
    checkbox.checked = selectedRows.has(rowId);
    checkbox.addEventListener('change', () => handleRowSelectionChange(row, checkbox));
  }

  /**
   * Handle row selection change
   * @param {Object} row - Row data
   * @param {HTMLInputElement} checkbox - Checkbox element
   */
  function handleRowSelectionChange(row, checkbox) {
    const rowId = getRowId(row);
    if (checkbox.checked) {
      selectedRows.add(rowId);
    } else {
      selectedRows.delete(rowId);
    }
    updateSelectAllState();
    if (onSelectionChange) {
      onSelectionChange(getSelectedRows());
    }
  }

  /**
   * Initialize select all checkbox
   * @param {HTMLInputElement} checkbox - Select all checkbox element
   */
  function initSelectAll(checkbox) {
    selectAllCheckbox = checkbox;
    checkbox.addEventListener('change', handleSelectAllChange);
    updateSelectAllState();
  }

  /**
   * Handle select all change
   * @param {Event} event - Change event
   */
  function handleSelectAllChange(event) {
    const checked = event.target.checked;
    rowCheckboxes.forEach((checkbox, rowId) => {
      checkbox.checked = checked;
      if (checked) {
        selectedRows.add(rowId);
      } else {
        selectedRows.delete(rowId);
      }
    });
    if (onSelectionChange) {
      onSelectionChange(getSelectedRows());
    }
  }

  /**
   * Update select all checkbox state
   */
  function updateSelectAllState() {
    if (!selectAllCheckbox) return;
    const visibleCount = rowCheckboxes.size;
    const selectedCount = Array.from(rowCheckboxes.keys()).filter(id => selectedRows.has(id)).length;
    
    if (selectedCount === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedCount === visibleCount) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  }

  /**
   * Apply selection styles to table rows
   * @param {HTMLTableElement} table - Table element
   * @param {Function} getRowId - Function to get row ID from row element
   */
  function applySelectionStyles(table, getRowId) {
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const rowId = getRowId(row);
      if (selectedRows.has(rowId)) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    });
  }

  /**
   * Get selected row data
   * @param {Array<Object>} fullData - Full dataset
   * @returns {Array<Object>} Selected rows
   */
  function getSelectedRows(fullData = []) {
    if (fullData.length === 0) {
      return Array.from(selectedRows).map(id => {
        try {
          return JSON.parse(id);
        } catch {
          return { id };
        }
      });
    }
    return fullData.filter(row => selectedRows.has(getRowId(row)));
  }

  /**
   * Get selected row IDs
   * @returns {Set<string>} Selected row IDs
   */
  function getSelectedIds() {
    return new Set(selectedRows);
  }

  /**
   * Check if row is selected
   * @param {Object} row - Row data
   * @returns {boolean} True if selected
   */
  function isSelected(row) {
    return selectedRows.has(getRowId(row));
  }

  /**
   * Select specific rows
   * @param {Array<Object>} rows - Rows to select
   */
  function selectRows(rows) {
    rows.forEach(row => {
      const rowId = getRowId(row);
      selectedRows.add(rowId);
      const checkbox = rowCheckboxes.get(rowId);
      if (checkbox) checkbox.checked = true;
    });
    updateSelectAllState();
    if (onSelectionChange) {
      onSelectionChange(getSelectedRows());
    }
  }

  /**
   * Deselect specific rows
   * @param {Array<Object>} rows - Rows to deselect
   */
  function deselectRows(rows) {
    rows.forEach(row => {
      const rowId = getRowId(row);
      selectedRows.delete(rowId);
      const checkbox = rowCheckboxes.get(rowId);
      if (checkbox) checkbox.checked = false;
    });
    updateSelectAllState();
    if (onSelectionChange) {
      onSelectionChange(getSelectedRows());
    }
  }

  /**
   * Clear all selections
   */
  function clearSelection() {
    selectedRows.clear();
    rowCheckboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    updateSelectAllState();
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  }

  /**
   * Get selection count
   * @returns {number} Number of selected rows
   */
  function getSelectionCount() {
    return selectedRows.size;
  }

  /**
   * Clear row checkboxes map (call when table is re-rendered)
   */
  function clearRowCheckboxes() {
    rowCheckboxes.clear();
  }

  /**
   * Destroy selection handler
   */
  function destroy() {
    if (selectAllCheckbox) {
      selectAllCheckbox.replaceWith(selectAllCheckbox.cloneNode(true));
    }
    rowCheckboxes.forEach(checkbox => {
      checkbox.replaceWith(checkbox.cloneNode(true));
    });
    rowCheckboxes.clear();
    selectedRows.clear();
  }

  return {
    init,
    registerRowCheckbox,
    initSelectAll,
    applySelectionStyles,
    getSelectedRows,
    getSelectedIds,
    isSelected,
    selectRows,
    deselectRows,
    clearSelection,
    getSelectionCount,
    clearRowCheckboxes,
    destroy
  };
}