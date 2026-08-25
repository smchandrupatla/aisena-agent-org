/**
 * Performance Module - Handles virtual scrolling, DOM diffing, and render optimizations
 * @module performance
 */

/**
 * Creates a performance handler
 * @param {Object} options - Configuration options
 * @param {number} options.virtualScrollThreshold - Row count threshold for virtual scrolling (default: 5000)
 * @param {number} options.rowHeight - Estimated row height in pixels (default: 44)
 * @param {number} options.bufferRows - Number of buffer rows above/below viewport (default: 10)
 * @returns {Object} Performance controller with methods
 */
export function createPerformance(options = {}) {
  const { 
    virtualScrollThreshold = 5000,
    rowHeight = 44,
    bufferRows = 10
  } = options;

  let isVirtualScrolling = false;
  let virtualScrollContainer = null;
  let virtualScrollContent = null;
  let lastRenderedRange = { start: 0, end: 0 };
  let renderCallback = null;

  /**
   * Initialize performance optimizations
   * @param {Object} config - Configuration
   * @param {HTMLElement} config.container - Scroll container
   * @param {HTMLElement} config.content - Content element (tbody)
   * @param {Function} config.renderRows - Callback to render rows (start, end)
   * @param {number} config.totalRows - Total number of rows
   */
  function init(config) {
    const { container, content, renderRows, totalRows } = config;
    
    virtualScrollContainer = container;
    virtualScrollContent = content;
    renderCallback = renderRows;

    // Check if virtual scrolling should be enabled
    isVirtualScrolling = totalRows >= virtualScrollThreshold;

    if (isVirtualScrolling) {
      setupVirtualScrolling(totalRows);
    } else {
      // Ensure normal rendering
      if (virtualScrollContent) {
        virtualScrollContent.style.height = 'auto';
        virtualScrollContent.style.position = 'relative';
      }
    }
  }

  /**
   * Setup virtual scrolling
   * @param {number} totalRows - Total number of rows
   */
  function setupVirtualScrolling(totalRows) {
    if (!virtualScrollContainer || !virtualScrollContent) return;

    // Set container to have fixed height and overflow
    virtualScrollContainer.style.overflowY = 'auto';
    virtualScrollContainer.style.position = 'relative';

    // Set content height to total scroll height
    const totalHeight = totalRows * rowHeight;
    virtualScrollContent.style.height = `${totalHeight}px`;
    virtualScrollContent.style.position = 'relative';

    // Add scroll listener with throttling
    let scrollTimeout = null;
    virtualScrollContainer.addEventListener('scroll', () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        handleVirtualScroll(totalRows);
        scrollTimeout = null;
      }, 16); // ~60fps
    }, { passive: true });

    // Initial render
    handleVirtualScroll(totalRows);
  }

  /**
   * Handle virtual scroll event
   * @param {number} totalRows - Total number of rows
   */
  function handleVirtualScroll(totalRows) {
    if (!virtualScrollContainer || !renderCallback) return;

    const scrollTop = virtualScrollContainer.scrollTop;
    const containerHeight = virtualScrollContainer.clientHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
    const endIndex = Math.min(
      totalRows,
      Math.ceil((scrollTop + containerHeight) / rowHeight) + bufferRows
    );

    // Only re-render if range changed significantly
    if (startIndex !== lastRenderedRange.start || endIndex !== lastRenderedRange.end) {
      lastRenderedRange = { start: startIndex, end: endIndex };
      
      // Update content transform to position visible rows
      const offsetY = startIndex * rowHeight;
      virtualScrollContent.style.transform = `translateY(${offsetY}px)`;
      
      // Render visible rows
      renderCallback(startIndex, endIndex);
    }
  }

  /**
   * Update virtual scrolling for new total rows
   * @param {number} totalRows - New total row count
   */
  function updateTotalRows(totalRows) {
    const wasVirtual = isVirtualScrolling;
    isVirtualScrolling = totalRows >= virtualScrollThreshold;

    if (isVirtualScrolling) {
      if (!wasVirtual) {
        setupVirtualScrolling(totalRows);
      } else if (virtualScrollContent) {
        const totalHeight = totalRows * rowHeight;
        virtualScrollContent.style.height = `${totalHeight}px`;
        handleVirtualScroll(totalRows);
      }
    } else if (wasVirtual) {
      // Disable virtual scrolling
      if (virtualScrollContainer) {
        virtualScrollContainer.style.overflowY = '';
        virtualScrollContainer.removeEventListener('scroll', handleVirtualScroll);
      }
      if (virtualScrollContent) {
        virtualScrollContent.style.height = 'auto';
        virtualScrollContent.style.transform = '';
        virtualScrollContent.style.position = 'relative';
      }
    }
  }

  /**
   * Simple DOM diffing for efficient updates
   * @param {HTMLElement} container - Container element
   * @param {Array<HTMLElement>} newNodes - New nodes to render
   * @param {Function} getKey - Function to get unique key from node
   */
  function diffAndRender(container, newNodes, getKey) {
    if (!container) return;

    const oldNodes = Array.from(container.children);
    const oldMap = new Map();
    oldNodes.forEach((node, index) => {
      const key = getKey ? getKey(node) : node.dataset.key || index;
      oldMap.set(key, { node, index });
    });

    const newMap = new Map();
    newNodes.forEach((node, index) => {
      const key = getKey ? getKey(node) : node.dataset.key || index;
      newMap.set(key, { node, index });
    });

    // Find nodes to remove
    const toRemove = [];
    oldMap.forEach((value, key) => {
      if (!newMap.has(key)) {
        toRemove.push(value.node);
      }
    });

    // Find nodes to add/update
    const fragment = document.createDocumentFragment();
    newNodes.forEach((newNode, newIndex) => {
      const key = getKey ? getKey(newNode) : newNode.dataset.key || newIndex;
      const oldEntry = oldMap.get(key);

      if (oldEntry) {
        // Node exists, check if it moved
        if (oldEntry.index !== newIndex) {
          // Move node
          fragment.appendChild(oldEntry.node);
        } else {
          // Keep in place, but update content if needed
          fragment.appendChild(oldEntry.node);
        }
        oldMap.delete(key);
      } else {
        // New node
        fragment.appendChild(newNode);
      }
    });

    // Remove old nodes
    toRemove.forEach(node => node.remove());

    // Replace container content
    container.innerHTML = '';
    container.appendChild(fragment);
  }

  /**
   * Batch DOM updates for better performance
   * @param {Function} callback - Callback with batched updates
   */
  function batchUpdates(callback) {
    // Use requestAnimationFrame to batch reads/writes
    requestAnimationFrame(() => {
      callback();
    });
  }

  /**
   * Debounce function
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in ms
   * @returns {Function} Debounced function
   */
  function debounce(fn, delay) {
    let timeoutId = null;
    return (...args) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Throttle function
   * @param {Function} fn - Function to throttle
   * @param {number} limit - Limit in ms
   * @returns {Function} Throttled function
   */
  function throttle(fn, limit) {
    let inThrottle = false;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Measure render performance
   * @param {string} label - Label for measurement
   * @param {Function} fn - Function to measure
   * @returns {*} Function result
   */
  function measure(label, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }

  /**
   * Check if virtual scrolling is enabled
   * @returns {boolean} True if virtual scrolling is active
   */
  function getIsVirtualScrolling() {
    return isVirtualScrolling;
  }

  /**
   * Destroy performance handler
   */
  function destroy() {
    if (virtualScrollContainer) {
      virtualScrollContainer.style.overflowY = '';
      virtualScrollContainer.removeEventListener('scroll', handleVirtualScroll);
    }
    if (virtualScrollContent) {
      virtualScrollContent.style.height = 'auto';
      virtualScrollContent.style.transform = '';
      virtualScrollContent.style.position = 'relative';
    }
    isVirtualScrolling = false;
    lastRenderedRange = { start: 0, end: 0 };
  }

  return {
    init,
    updateTotalRows,
    diffAndRender,
    batchUpdates,
    debounce,
    throttle,
    measure,
    getIsVirtualScrolling,
    destroy
  };
}