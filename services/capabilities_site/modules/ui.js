/**
 * UI Module - Handles copy cell value, copy row JSON, tooltips, sticky header, and general UI polish
 * @module ui
 */

/**
 * Creates a UI handler
 * @param {Object} options - Configuration options
 * @returns {Object} UI controller with methods
 */
export function createUI() {
  let table = null;
  let tooltips = new Map();

  /**
   * Initialize UI enhancements
   * @param {HTMLTableElement} tableElement - Table element
   */
  function init(tableElement) {
    table = tableElement;
    if (!table) return;

    initStickyHeader();
    initCellClickCopy();
    initRowClickCopy();
    initTooltips();
    initKeyboardNavigation();
  }

  /**
   * Initialize sticky header
   */
  function initStickyHeader() {
    if (!table) return;
    
    const thead = table.querySelector('thead');
    if (thead) {
      thead.style.position = 'sticky';
      thead.style.top = '0';
      thead.style.zIndex = '10';
      thead.style.background = 'var(--bg-soft, #f6f9ff)';
    }
  }

  /**
   * Initialize cell click to copy value
   */
  function initCellClickCopy() {
    if (!table) return;

    table.addEventListener('click', event => {
      const cell = event.target.closest('td');
      if (!cell) return;

      // Don't copy if clicking on checkbox
      if (cell.querySelector('input[type="checkbox"]')) return;

      const value = cell.textContent.trim();
      if (value) {
        copyToClipboard(value);
        showToast(`Copied: "${truncate(value, 50)}"`);
      }
    });
  }

  /**
   * Initialize row click to copy JSON (Ctrl+Click or context menu)
   */
  function initRowClickCopy() {
    if (!table) return;

    table.addEventListener('click', event => {
      const row = event.target.closest('tr');
      if (!row || row.parentElement?.tagName === 'THEAD') return;

      // Ctrl+Click or Meta+Click to copy row as JSON
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rowData = getRowData(row);
        if (rowData) {
          copyToClipboard(JSON.stringify(rowData, null, 2));
          showToast('Row copied as JSON');
        }
      }
    });

    // Context menu for row actions
    table.addEventListener('contextmenu', event => {
      const row = event.target.closest('tr');
      if (!row || row.parentElement?.tagName === 'THEAD') return;

      event.preventDefault();
      showContextMenu(event.clientX, event.clientY, row);
    });
  }

  /**
   * Get row data from table row
   * @param {HTMLTableRowElement} row - Table row
   * @returns {Object|null} Row data object
   */
  function getRowData(row) {
    if (!table) return null;

    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const cells = Array.from(row.querySelectorAll('td'));
    
    const data = {};
    cells.forEach((cell, index) => {
      if (headers[index]) {
        data[headers[index]] = cell.textContent.trim();
      }
    });
    return data;
  }

  /**
   * Show context menu for row
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {HTMLTableRowElement} row - Table row
   */
  function showContextMenu(x, y, row) {
    // Remove existing context menu
    const existing = document.querySelector('.ui-context-menu');
    if (existing) existing.remove();

    const rowData = getRowData(row);
    const menu = document.createElement('div');
    menu.className = 'ui-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      background: var(--panel, #fff);
      border: 1px solid var(--line, #dce4f2);
      border-radius: var(--radius-md, 12px);
      box-shadow: var(--shadow-card, 0 18px 42px rgba(22, 57, 130, 0.12));
      padding: 8px 0;
      z-index: 1000;
      min-width: 180px;
    `;

    const actions = [
      { label: 'Copy Row as JSON', action: () => copyRowJson(rowData) },
      { label: 'Copy Row as CSV', action: () => copyRowCsv(rowData) },
      { label: 'Copy Cell Value', action: () => copyCellValue(event.target.closest('td')) }
    ];

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.style.cssText = `
        width: 100%;
        padding: 8px 16px;
        border: none;
        background: none;
        text-align: left;
        font: inherit;
        color: var(--ink, #101a2d);
        cursor: pointer;
      `;
      btn.addEventListener('mouseenter', () => btn.style.background = 'var(--bg-soft, #e9eef8)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
      btn.addEventListener('click', () => {
        action.action();
        menu.remove();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // Close on click outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  /**
   * Copy row as JSON
   * @param {Object} rowData - Row data
   */
  function copyRowJson(rowData) {
    if (!rowData) return;
    copyToClipboard(JSON.stringify(rowData, null, 2));
    showToast('Row copied as JSON');
  }

  /**
   * Copy row as CSV
   * @param {Object} rowData - Row data
   */
  function copyRowCsv(rowData) {
    if (!rowData) return;
    const values = Object.values(rowData).map(v => escapeCsvValue(v)).join(',');
    copyToClipboard(values);
    showToast('Row copied as CSV');
  }

  /**
   * Copy cell value
   * @param {HTMLTableCellElement} cell - Table cell
   */
  function copyCellValue(cell) {
    if (!cell) return;
    const value = cell.textContent.trim();
    if (value) {
      copyToClipboard(value);
      showToast(`Copied: "${truncate(value, 50)}"`);
    }
  }

  /**
   * Initialize tooltips
   */
  function initTooltips() {
    if (!table) return;

    table.addEventListener('mouseover', event => {
      const cell = event.target.closest('td');
      if (!cell) return;

      const text = cell.textContent.trim();
      if (text.length > 50 || cell.scrollWidth > cell.clientWidth) {
        showTooltip(cell, text);
      }
    });

    table.addEventListener('mouseout', event => {
      const cell = event.target.closest('td');
      if (cell) {
        hideTooltip(cell);
      }
    });
  }

  /**
   * Show tooltip for cell
   * @param {HTMLTableCellElement} cell - Table cell
   * @param {string} text - Tooltip text
   */
  function showTooltip(cell, text) {
    hideTooltip(cell);

    const tooltip = document.createElement('div');
    tooltip.className = 'ui-tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: absolute;
      background: var(--ink, #101a2d);
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      z-index: 100;
      pointer-events: none;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    document.body.appendChild(tooltip);

    const rect = cell.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 8}px`;

    tooltips.set(cell, tooltip);
  }

  /**
   * Hide tooltip for cell
   * @param {HTMLTableCellElement} cell - Table cell
   */
  function hideTooltip(cell) {
    const tooltip = tooltips.get(cell);
    if (tooltip) {
      tooltip.remove();
      tooltips.delete(cell);
    }
  }

  /**
   * Initialize keyboard navigation
   */
  function initKeyboardNavigation() {
    if (!table) return;

    table.addEventListener('keydown', event => {
      const target = event.target.closest('td, th');
      if (!target) return;

      let nextCell = null;

      switch (event.key) {
        case 'ArrowRight':
          nextCell = target.nextElementSibling;
          break;
        case 'ArrowLeft':
          nextCell = target.previousElementSibling;
          break;
        case 'ArrowDown':
          nextCell = getCellInDirection(target, 'down');
          break;
        case 'ArrowUp':
          nextCell = getCellInDirection(target, 'up');
          break;
        case 'Enter':
        case ' ':
          if (target.tagName === 'TH') {
            target.click(); // Trigger sort
          } else if (target.tagName === 'TD') {
            // Copy cell value on Enter/Space
            event.preventDefault();
            const value = target.textContent.trim();
            if (value) {
              copyToClipboard(value);
              showToast(`Copied: "${truncate(value, 50)}"`);
            }
          }
          break;
        case 'Home':
          nextCell = target.parentElement.firstElementChild;
          break;
        case 'End':
          nextCell = target.parentElement.lastElementChild;
          break;
      }

      if (nextCell) {
        event.preventDefault();
        nextCell.focus();
      }
    });

    // Make cells focusable
    table.querySelectorAll('td, th').forEach(cell => {
      cell.setAttribute('tabindex', '0');
    });
  }

  /**
   * Get cell in direction
   * @param {HTMLTableCellElement} cell - Current cell
   * @param {string} direction - Direction ('up' or 'down')
   * @returns {HTMLTableCellElement|null} Next cell
   */
  function getCellInDirection(cell, direction) {
    const row = cell.parentElement;
    const index = Array.from(row.children).indexOf(cell);
    const tbody = row.parentElement;
    const rows = Array.from(tbody.rows);
    const rowIndex = rows.indexOf(row);

    if (direction === 'down' && rowIndex < rows.length - 1) {
      return rows[rowIndex + 1].cells[index];
    } else if (direction === 'up' && rowIndex > 0) {
      return rows[rowIndex - 1].cells[index];
    }
    return null;
  }

  /**
   * Show toast notification
   * @param {string} message - Message to show
   * @param {number} duration - Duration in ms (default: 2000)
   */
  function showToast(message, duration = 2000) {
    const existing = document.querySelector('.ui-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'ui-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--ink, #101a2d);
      color: #fff;
      padding: 12px 20px;
      border-radius: var(--radius-md, 12px);
      box-shadow: var(--shadow-card, 0 18px 42px rgba(22, 57, 130, 0.12));
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;

    // Add animation styles if not present
    if (!document.querySelector('#ui-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'ui-toast-styles';
      style.textContent = `
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(20px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Show loading indicator
   * @param {HTMLElement} container - Container element
   * @param {string} message - Loading message
   */
  function showLoading(container, message = 'Loading...') {
    if (!container) return;
    container.innerHTML = `
      <div class="ui-loading" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: var(--ink-soft, #4d5d78);
      ">
        <div class="spinner" style="
          width: 32px;
          height: 32px;
          border: 3px solid var(--line, #dce4f2);
          border-top-color: var(--brand, #2363eb);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 12px;
        "></div>
        <span>${escapeHtml(message)}</span>
      </div>
    `;

    // Add spinner animation if not present
    if (!document.querySelector('#ui-spinner-styles')) {
      const style = document.createElement('style');
      style.id = 'ui-spinner-styles';
      style.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Show empty state
   * @param {HTMLElement} container - Container element
   * @param {string} message - Empty state message
   * @param {string} icon - Icon (optional)
   */
  function showEmptyState(container, message = 'No data available', icon = '📭') {
    if (!container) return;
    container.innerHTML = `
      <div class="ui-empty-state" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        color: var(--ink-soft, #4d5d78);
        text-align: center;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">${escapeHtml(icon)}</div>
        <p style="margin: 0; font-size: 16px;">${escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * Show error state
   * @param {HTMLElement} container - Container element
   * @param {string} message - Error message
   */
  function showError(container, message = 'An error occurred') {
    if (!container) return;
    container.innerHTML = `
      <div class="ui-error-state" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: var(--warn, #d24b57);
        text-align: center;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <p style="margin: 0; font-size: 16px;">${escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch {
        document.body.removeChild(textarea);
        return false;
      }
    }
  }

  /**
   * Escape CSV value
   * @param {string} value - Value to escape
   * @returns {string} Escaped value
   */
  function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Truncate string
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated string
   */
  function truncate(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
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

  /**
   * Destroy UI handler
   */
  function destroy() {
    tooltips.forEach(tooltip => tooltip.remove());
    tooltips.clear();
  }

  return {
    init,
    showToast,
    showLoading,
    showEmptyState,
    showError,
    copyToClipboard,
    destroy
  };
}