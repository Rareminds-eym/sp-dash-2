import { NextResponse } from 'next/server';

/**
 * Centralized error handler for API routes
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 * @returns {NextResponse} Error response
 */
export function handleError(error, context = 'API') {
  console.error(`[${context}] Error:`, error);
  
  // Check if it's a Supabase error
  if (error.code) {
    return NextResponse.json(
      { 
        error: `Database error: ${error.message}`,
        code: error.code
      }, 
      { status: 500 }
    );
  }
  
  // Generic error
  return NextResponse.json(
    { 
      error: error.message || 'Internal server error',
      context
    }, 
    { status: 500 }
  );
}

/**
 * Not found error response
 * @param {string} resource - Resource type that wasn't found
 * @returns {NextResponse} 404 response
 */
export function notFoundError(resource = 'Resource') {
  return NextResponse.json(
    { error: `${resource} not found` },
    { status: 404 }
  );
}
