/**
 * Export Module - Handles CSV, JSON, and XLSX export
 * @module export
 */

/**
 * Creates an export handler
 * @param {Object} options - Configuration options
 * @returns {Object} Export controller with methods
 */
export function createExport() {
  /**
   * Escape CSV value
   * @param {string} value - Value to escape
   * @returns {string} Escaped value
   */
  function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape double quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Convert data to CSV
   * @param {Array<Object>} data - Data to export
   * @param {Array<string>} columns - Column names
   * @returns {string} CSV string
   */
  function toCsv(data, columns) {
    if (!data.length) return '';
    
    const header = columns.map(escapeCsvValue).join(',');
    const rows = data.map(row => 
      columns.map(col => escapeCsvValue(row[col])).join(',')
    );
    
    return [header, ...rows].join('\n');
  }

  /**
   * Convert data to JSON
   * @param {Array<Object>} data - Data to export
   * @returns {string} JSON string
   */
  function toJson(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Convert data to XLSX (using CSV format with .xlsx extension)
   * Note: For true XLSX, a library like SheetJS would be needed.
   * This creates a CSV that Excel can open.
   * @param {Array<Object>} data - Data to export
   * @param {Array<string>} columns - Column names
   * @returns {string} CSV string (for XLSX compatibility)
   */
  function toXlsx(data, columns) {
    // For true XLSX support, you would use SheetJS (xlsx) library
    // This returns CSV which Excel can open as .xlsx
    return toCsv(data, columns);
  }

  let sheetJsPromise = null;

  /**
   * Lazily load the SheetJS library from CDN (only once)
   * @returns {Promise<Object>} Resolves to the global XLSX object
   */
  function loadSheetJs() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (sheetJsPromise) return sheetJsPromise;

    sheetJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error('Failed to load XLSX library'));
      document.head.appendChild(script);
    });

    return sheetJsPromise;
  }

  /**
   * Build a real XLSX binary workbook from tabular data
   * @param {Array<Object>} data - Data to export
   * @param {Array<string>} columns - Column names
   * @returns {Promise<ArrayBuffer>} XLSX file contents
   */
  async function buildXlsxWorkbook(data, columns) {
    const XLSX = await loadSheetJs();
    const rows = data.map(row => columns.map(col => (row[col] === null || row[col] === undefined) ? '' : row[col]));
    const sheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Export');
    return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  }

  /**
   * Download file
   * @param {string} content - File content
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   */
  function download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export data as CSV
   * @param {Array<Object>} data - Data to export
   * @param {Array<string>} columns - Column names
   * @param {string} filename - Filename (default: export.csv)
   */
  function exportCsv(data, columns, filename = 'export.csv') {
    const csv = toCsv(data, columns);
    download(csv, filename, 'text/csv;charset=utf-8;');
  }

  /**
   * Export data as JSON
   * @param {Array<Object>} data - Data to export
   * @param {string} filename - Filename (default: export.json)
   */
  function exportJson(data, filename = 'export.json') {
    const json = toJson(data);
    download(json, filename, 'application/json;charset=utf-8;');
  }

  /**
   * Export data as XLSX (real binary workbook via SheetJS, falls back to CSV if the library can't load)
   * @param {Array<Object>} data - Data to export
   * @param {Array<string>} columns - Column names
   * @param {string} filename - Filename (default: export.xlsx)
   */
  async function exportXlsx(data, columns, filename = 'export.xlsx') {
    try {
      const buffer = await buildXlsxWorkbook(data, columns);
      download(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (error) {
      console.warn('XLSX export fell back to CSV:', error);
      const csv = toXlsx(data, columns);
      download(csv, filename.replace(/\.xlsx$/, '.csv'), 'text/csv;charset=utf-8;');
    }
  }

  /**
   * Export data in specified format
   * @param {string} format - Export format ('csv', 'json', 'xlsx')
   * @param {Array<Object>} data - Data to export
   * @param {Array<string>} columns - Column names
   * @param {string} filename - Filename
   */
  async function exportData(format, data, columns, filename) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const defaultName = `postgres-export-${timestamp}`;
    
    switch (format.toLowerCase()) {
      case 'csv':
        exportCsv(data, columns, filename || `${defaultName}.csv`);
        break;
      case 'json':
        exportJson(data, filename || `${defaultName}.json`);
        break;
      case 'xlsx':
        await exportXlsx(data, columns, filename || `${defaultName}.xlsx`);
        break;
      default:
        console.warn(`Unknown export format: ${format}`);
    }
  }

  return {
    toCsv,
    toJson,
    toXlsx,
    exportCsv,
    exportJson,
    exportXlsx,
    exportData
  };
}