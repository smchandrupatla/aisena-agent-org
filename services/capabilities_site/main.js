/**
 * Main Application - Postgres Viewer
 * Integrates all modules and manages global state
 * @module main
 */

import { createSearch } from './modules/search.js';
import { createSort } from './modules/sort.js';
import { createPagination } from './modules/pagination.js';
import { createSelection } from './modules/selection.js';
import { createExport } from './modules/export.js';
import { createColumns } from './modules/columns.js';
import { createUI } from './modules/ui.js';
import { createPerformance } from './modules/performance.js';

// Global state
const state = {
  fullData: [],
  filteredData: [],
  columns: [],
  sort: { column: null, direction: null },
  search: '',
  page: 1,
  pageSize: 25,
  selected: new Set(),
  hiddenColumns: new Set(),
  currentTable: null
};

// Module instances
const modules = {
  search: null,
  sort: null,
  pagination: null,
  selection: null,
  export: null,
  columns: null,
  ui: null,
  performance: null
};

// DOM elements
const elements = {
  tableContainer: null,
  table: null,
  tbody: null,
  thead: null,
  searchInput: null,
  pageSizeSelect: null,
  prevButton: null,
  nextButton: null,
  pageInfo: null,
  selectAllCheckbox: null,
  columnsToggles: null,
  csvButton: null,
  jsonButton: null,
  xlsxButton: null,
  selectionSummary: null,
  tableName: null,
  tableCount: null,
  loadingOverlay: null
};

/**
 * Initialize the application
 */
async function init() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
  }

  // Cache DOM elements
  cacheElements();

  // Load data from window.__POSTGRES_DATA__ or fetch from API
  await loadData();

  // Initialize modules
  initializeModules();

  // Initial render
  render();

  // Expose for debugging
  window.postgresViewer = {
    state,
    modules,
    render,
    refresh: loadData
  };
}

/**
 * Cache DOM element references
 */
function cacheElements() {
  elements.tableContainer = document.getElementById('tableDataContainer');
  elements.table = document.getElementById('dataTable');
  elements.tbody = document.getElementById('tableBody');
  elements.thead = document.getElementById('tableHead');
  elements.searchInput = document.getElementById('searchInput');
  elements.pageSizeSelect = document.getElementById('pageSizeSelect');
  elements.prevButton = document.getElementById('prevPage');
  elements.nextButton = document.getElementById('nextPage');
  elements.pageInfo = document.getElementById('pageInfo');
  elements.selectAllCheckbox = document.getElementById('selectAll');
  elements.columnsToggles = document.getElementById('columnsToggles');
  elements.csvButton = document.getElementById('exportCsv');
  elements.jsonButton = document.getElementById('exportJson');
  elements.xlsxButton = document.getElementById('exportXlsx');
  elements.selectionSummary = document.getElementById('selectionSummary');
  elements.tableName = document.getElementById('selectedTableName');
  elements.tableCount = document.getElementById('selectedTableCount');
  elements.loadingOverlay = document.getElementById('loadingOverlay');
}

/**
 * Load data from API or window.__POSTGRES_DATA__
 */
async function loadData() {
  showLoading(true);

  try {
    // Check for preloaded data
    if (window.__POSTGRES_DATA__ && window.__POSTGRES_DATA__.rows?.length) {
      state.fullData = window.__POSTGRES_DATA__.rows;
      state.columns = window.__POSTGRES_DATA__.columns || [];
      state.currentTable = window.__POSTGRES_DATA__.table;
      updateTableInfo();
    } else {
      // Fetch from API - get available tables first
      const tablesResponse = await fetch('/db-tables');
      const tablesData = await tablesResponse.json();
      
      if (tablesData.tables?.length) {
        // Load first table by default
        const firstTable = tablesData.aisena_tables?.[0] || tablesData.tables[0];
        await loadTable(firstTable);
      }
    }
  } catch (error) {
    console.error('Failed to load data:', error);
    showError(`Failed to load data: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

/**
 * Load specific table data
 * @param {string} tableName - Table name to load
 */
async function loadTable(tableName) {
  showLoading(true);
  state.currentTable = tableName;

  try {
    const response = await fetch(`/db-tables/${encodeURIComponent(tableName)}?limit=5000`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load table');
    }

    state.fullData = data.rows || [];
    state.columns = data.columns || [];
    state.page = 1; // Reset to first page
    state.selected.clear(); // Clear selection
    
    updateTableInfo();
    
    // Re-initialize modules with new columns
    modules.columns.updateColumns(state.columns);
    modules.sort.init(elements.thead?.querySelectorAll('th') || [], state.columns);
    
    render();
  } catch (error) {
    console.error('Failed to load table:', error);
    showError(`Failed to load table: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

/**
 * Update table info display
 */
function updateTableInfo() {
  if (elements.tableName) {
    elements.tableName.textContent = state.currentTable || 'Select a table';
  }
  if (elements.tableCount) {
    elements.tableCount.textContent = `${state.fullData.length} row${state.fullData.length !== 1 ? 's' : ''}`;
  }
}

/**
 * Initialize all modules
 */
function initializeModules() {
  // Search module
  modules.search = createSearch({
    debounceMs: 250,
    onSearch: (term) => {
      state.search = term;
      state.page = 1; // Reset to first page on search
      render();
    }
  });
  modules.search.init(elements.searchInput);

  // Sort module
  modules.sort = createSort({
    onSort: (sortState) => {
      state.sort = sortState;
      render();
    }
  });

  // Pagination module
  modules.pagination = createPagination({
    defaultPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    onPageChange: (page) => {
      state.page = page;
      render();
    },
    onPageSizeChange: (pageSize) => {
      state.pageSize = pageSize;
      state.page = 1;
      render();
    }
  });
  modules.pagination.init({
    container: document.getElementById('paginationContainer'),
    prevButton: elements.prevButton,
    nextButton: elements.nextButton,
    pageInfo: elements.pageInfo,
    pageSizeSelect: elements.pageSizeSelect
  });

  // Selection module
  modules.selection = createSelection({
    onSelectionChange: (selectedRows) => {
      state.selected = new Set(selectedRows.map(row => JSON.stringify(row)));
      updateSelectionSummary();
    }
  });
  modules.selection.init((row) => JSON.stringify(row));
  if (elements.selectAllCheckbox) {
    modules.selection.initSelectAll(elements.selectAllCheckbox);
  }

  // Export module
  modules.export = createExport();

  // Columns module
  modules.columns = createColumns({
    storageKey: `postgres-viewer-columns-${state.currentTable || 'default'}`,
    onColumnsChange: (visibleColumns) => {
      state.hiddenColumns = new Set(state.columns.filter(c => !visibleColumns.includes(c)));
    }
  });

  // UI module
  modules.ui = createUI();

  // Performance module
  modules.performance = createPerformance({
    virtualScrollThreshold: 5000,
    rowHeight: 44,
    bufferRows: 10
  });

  // Export button handlers
  if (elements.csvButton) {
    elements.csvButton.addEventListener('click', () => handleExport('csv'));
  }
  if (elements.jsonButton) {
    elements.jsonButton.addEventListener('click', () => handleExport('json'));
  }
  if (elements.xlsxButton) {
    elements.xlsxButton.addEventListener('click', () => handleExport('xlsx'));
  }

  // Table selector buttons (if present)
  document.querySelectorAll('.db-table-button').forEach(button => {
    button.addEventListener('click', () => loadTable(button.textContent.trim()));
  });
}

/**
 * Main render pipeline
 * fullData → applySearch() → applySort() → applyPagination() → renderTable()
 */
function render() {
  // Pipeline: search → sort → pagination
  let data = state.fullData;

  // Apply search
  if (modules.search) {
    data = modules.search.filter(data, state.columns);
  }

  // Apply sort
  if (modules.sort) {
    data = modules.sort.sort(data);
  }

  state.filteredData = data;

  // Update pagination total
  if (modules.pagination) {
    modules.pagination.setTotalItems(data.length);
  }

  // Apply pagination
  let pageData = data;
  if (modules.pagination) {
    pageData = modules.pagination.paginate(data);
  }

  // Render table
  renderTable(pageData);

  // Apply selection styles
  if (modules.selection && elements.table) {
    modules.selection.applySelectionStyles(elements.table, (row) => {
      const cells = Array.from(row.cells).slice(1); // Skip checkbox column
      return JSON.stringify(cells.map(c => c.textContent.trim()));
    });
  }

  // Apply column visibility
  if (modules.columns) {
    modules.columns.applyVisibility();
  }

  // Render pagination controls
  if (modules.pagination) {
    modules.pagination.updatePagination();
  }

  // Render selection summary
  updateSelectionSummary();

  // Initialize UI enhancements on table
  if (modules.ui && elements.table) {
    modules.ui.init(elements.table);
  }

  // Initialize performance optimizations
  if (modules.performance && elements.tableContainer && elements.tbody) {
    modules.performance.init({
      container: elements.tableContainer,
      content: elements.tbody,
      renderRows: (start, end) => renderTableRows(pageData.slice(start, end)),
      totalRows: pageData.length
    });
  }
}

/**
 * Render table with data
 * @param {Array<Object>} data - Data to render
 */
function renderTable(data) {
  if (!elements.thead || !elements.tbody) return;

  // Render header
  renderHeader();

  // Render body
  renderTableRows(data);

  // Register row checkboxes for selection
  registerRowCheckboxes(data);
}

/**
 * Render table header
 */
function renderHeader() {
  if (!elements.thead) return;

  const checkboxColumn = '<th scope="col"><input type="checkbox" id="selectAll" aria-label="Select all rows"></th>';
  const dataColumns = state.columns.map((col, index) => {
    const isHidden = state.hiddenColumns.has(col);
    const hiddenAttr = isHidden ? ' hidden' : '';
    const style = isHidden ? ' style="display:none;"' : '';
    return `<th scope="col" data-column="${escapeHtml(col)}"${hiddenAttr}${style}>${escapeHtml(col)}</th>`;
  }).join('');

  elements.thead.innerHTML = `<tr>${checkboxColumn}${dataColumns}</tr>`;

  // Re-initialize sort with new headers
  if (modules.sort) {
    modules.sort.init(elements.thead.querySelectorAll('th'), ['select', ...state.columns]);
    modules.sort.setSortState(state.sort.column, state.sort.direction);
  }

  // Re-initialize select all checkbox
  const newSelectAll = elements.thead.querySelector('#selectAll');
  if (newSelectAll && modules.selection) {
    modules.selection.initSelectAll(newSelectAll);
  }
}

/**
 * Render table body rows
 * @param {Array<Object>} data - Data to render
 */
function renderTableRows(data) {
  if (!elements.tbody) return;

  if (!data.length) {
    elements.tbody.innerHTML = `
      <tr>
        <td colspan="${state.columns.length + 1}" style="text-align:center; padding:40px; color:var(--ink-soft, #4d5d78);">
          No data to display
        </td>
      </tr>
    `;
    return;
  }

  const searchTerm = modules.search?.getSearchTerm() || '';

  elements.tbody.innerHTML = data.map((row, rowIndex) => {
    const rowId = JSON.stringify(row);
    const isSelected = state.selected.has(rowId);
    const selectedClass = isSelected ? ' selected' : '';
    const checkboxId = `row-checkbox-${rowIndex}`;

    const checkboxCell = `<td><input type="checkbox" id="${checkboxId}" class="row-checkbox" data-row-id="${escapeHtml(rowId)}" ${isSelected ? 'checked' : ''} aria-label="Select row"></td>`;

    const dataCells = state.columns.map((col, colIndex) => {
      const value = row[col];
      const displayValue = value === null ? '<span class="db-null">NULL</span>' : escapeHtml(String(value));
      const highlightedValue = searchTerm ? highlightText(displayValue, searchTerm) : displayValue;
      const isHidden = state.hiddenColumns.has(col);
      const hiddenAttr = isHidden ? ' hidden' : '';
      const style = isHidden ? ' style="display:none;"' : '';
      return `<td${hiddenAttr}${style}>${highlightedValue}</td>`;
    }).join('');

    return `<tr data-row-id="${escapeHtml(rowId)}" class="${selectedClass}">${checkboxCell}${dataCells}</tr>`;
  }).join('');
}

/**
 * Register row checkboxes with selection module
 * @param {Array<Object>} data - Current page data
 */
function registerRowCheckboxes(data) {
  if (!modules.selection) return;
  
  modules.selection.clearRowCheckboxes();
  
  const checkboxes = elements.tbody?.querySelectorAll('.row-checkbox');
  checkboxes?.forEach((checkbox, index) => {
    const rowId = checkbox.dataset.rowId;
    const rowData = data[index];
    if (rowData) {
      modules.selection.registerRowCheckbox(rowData, checkbox);
    }
  });
}

/**
 * Highlight search matches in text
 * @param {string} text - Text to highlight
 * @param {string} term - Search term
 * @returns {string} Highlighted text
 */
function highlightText(text, term) {
  if (!term || !text) return text;
  const escaped = escapeRegExp(term);
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * Update selection summary display
 */
function updateSelectionSummary() {
  if (!elements.selectionSummary) return;
  
  const count = state.selected.size;
  if (count === 0) {
    elements.selectionSummary.textContent = '';
    elements.selectionSummary.style.display = 'none';
  } else {
    elements.selectionSummary.textContent = `${count} row${count !== 1 ? 's' : ''} selected`;
    elements.selectionSummary.style.display = 'inline-flex';
  }
}

/**
 * Handle export button clicks
 * @param {string} format - Export format
 */
function handleExport(format) {
  const selectedRows = modules.selection?.getSelectedRows(state.filteredData) || [];
  const dataToExport = selectedRows.length > 0 ? selectedRows : state.filteredData;
  const visibleColumns = modules.columns?.getVisibleColumns() || state.columns;

  if (dataToExport.length === 0) {
    modules.ui?.showToast('No data to export');
    return;
  }

  modules.export?.exportData(format, dataToExport, visibleColumns);
  modules.ui?.showToast(`Exported ${dataToExport.length} row${dataToExport.length !== 1 ? 's' : ''} as ${format.toUpperCase()}`);
}

/**
 * Show/hide loading overlay
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
  if (elements.loadingOverlay) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
  }
  if (elements.tableContainer && show) {
    modules.ui?.showLoading(elements.tableContainer, 'Loading table data...');
  }
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
  if (elements.tableContainer) {
    modules.ui?.showError(elements.tableContainer, message);
  }
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape regex special characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Initialize on load
init();