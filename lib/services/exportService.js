/**
 * Generate CSV content from data array
 * @param {Array} headers - Column headers
 * @param {Array} rows - Data rows
 * @returns {string} CSV content
 */
export function generateCSV(headers, rows) {
  const csvRows = [headers.join(',')];
  
  rows.forEach(row => {
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * Create CSV Response with proper headers
 * @param {string} csvContent - CSV content
 * @param {string} filename - Download filename
 * @returns {Response} CSV download response
 */
export function createCSVResponse(csvContent, filename) {
  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
