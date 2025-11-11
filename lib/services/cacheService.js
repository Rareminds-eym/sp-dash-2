/**
 * Add cache headers to a NextResponse
 * @param {NextResponse} response - The response object
 * @param {string} cacheType - Cache type: 'static', 'dynamic', 'private', 'no-cache'
 * @returns {NextResponse} Response with cache headers
 */
export function addCacheHeaders(response, cacheType = 'private') {
  const cacheHeaders = {
    // Static data (universities, recruiters list) - 5 minutes
    'static': 'public, max-age=300, stale-while-revalidate=600',
    // Dynamic data with short TTL (metrics, dashboard) - 1 minute
    'dynamic': 'public, max-age=60, stale-while-revalidate=120',
    // User-specific data - 30 seconds
    'private': 'private, max-age=30',
    // No cache for mutations
    'no-cache': 'no-store, must-revalidate'
  };
  
  response.headers.set('Cache-Control', cacheHeaders[cacheType] || cacheHeaders['private']);
  response.headers.set('X-Cache-Type', cacheType);
  return response;
}
