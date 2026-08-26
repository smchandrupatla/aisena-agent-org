/**
 * Search Module - Handles client-side multi-column search with debouncing and highlighting
 * @module search
 */

/**
 * Creates a search handler with debouncing
 * @param {Object} options - Configuration options
 * @param {number} options.debounceMs - Debounce delay in milliseconds (default: 250)
 * @param {Function} options.onSearch - Callback when search results change
 * @returns {Object} Search controller with methods
 */
export function createSearch(options = {}) {
  const { debounceMs = 250, onSearch } = options;
  let searchTerm = '';
  let debounceTimer = null;
  let searchInput = null;

  /**
   * Initialize search input element
   * @param {HTMLInputElement} input - Search input element
   */
  function init(input) {
    searchInput = input;
    if (!searchInput) return;

    searchInput.addEventListener('input', handleInput);
    searchInput.addEventListener('keydown', handleKeydown);
  }

  /**
   * Handle input event with debouncing
   * @param {Event} event - Input event
   */
  function handleInput(event) {
    const value = event.target.value.trim();
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      searchTerm = value;
      if (onSearch) {
        onSearch(searchTerm);
      }
    }, debounceMs);
  }

  /**
   * Handle keydown for keyboard navigation
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      clearSearch();
    }
  }

  /**
   * Filter dataset based on search term
   * @param {Array<Object>} data - Full dataset
   * @param {Array<string>} columns - Column names to search
   * @returns {Array<Object>} Filtered dataset
   */
  function filter(data, columns) {
    if (!searchTerm) return data;

    const term = searchTerm.toLowerCase();
    return data.filter(row => {
      return columns.some(col => {
        const value = row[col];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }

  /**
   * Highlight matched text in a string
   * @param {string} text - Text to highlight
   * @returns {string} HTML with highlighted matches
   */
  function highlight(text) {
    if (!searchTerm || !text) return text;
    
    const term = searchTerm.trim();
    if (!term) return text;

    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  /**
   * Get current search term
   * @returns {string} Current search term
   */
  function getSearchTerm() {
    return searchTerm;
  }

  /**
   * Set search term programmatically
   * @param {string} term - Search term
   */
  function setSearchTerm(term) {
    searchTerm = term || '';
    if (searchInput) {
      searchInput.value = searchTerm;
    }
  }

  /**
   * Clear search
   */
  function clearSearch() {
    searchTerm = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    if (onSearch) {
      onSearch('');
    }
  }

  /**
   * Destroy search handler
   */
  function destroy() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (searchInput) {
      searchInput.removeEventListener('input', handleInput);
      searchInput.removeEventListener('keydown', handleKeydown);
    }
  }

  return {
    init,
    filter,
    highlight,
    getSearchTerm,
    setSearchTerm,
    clearSearch,
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

/**
 * Escape regex special characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}