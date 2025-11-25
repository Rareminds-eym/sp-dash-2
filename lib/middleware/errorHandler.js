import { NextResponse } from 'next/server';

/**
 * Standard error codes for consistent error handling
 */
export const ERROR_CODES = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_JSON: 'INVALID_JSON',
  
  // Server errors (5xx)
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

/**
 * Map Supabase error codes to HTTP status codes and error types
 */
const SUPABASE_ERROR_MAP = {
  '23505': { status: 409, type: ERROR_CODES.CONFLICT, message: 'A record with this value already exists' },
  '23503': { status: 400, type: ERROR_CODES.VALIDATION_ERROR, message: 'Referenced record does not exist' },
  '23502': { status: 400, type: ERROR_CODES.VALIDATION_ERROR, message: 'Required field is missing' },
  '22P02': { status: 400, type: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid data format' },
  'PGRST116': { status: 404, type: ERROR_CODES.NOT_FOUND, message: 'Record not found' },
  '42P01': { status: 500, type: ERROR_CODES.DATABASE_ERROR, message: 'Database table does not exist' },
  '42703': { status: 500, type: ERROR_CODES.DATABASE_ERROR, message: 'Database column does not exist' },
};

/**
 * Custom Application Error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = ERROR_CODES.INTERNAL_ERROR, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

/**
 * Structured error logger
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 * @param {Object} metadata - Additional metadata
 */
export function logError(error, context = 'API', metadata = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    context,
    message: error.message,
    stack: error.stack,
    ...metadata
  };

  if (error instanceof AppError) {
    errorLog.statusCode = error.statusCode;
    errorLog.code = error.code;
    errorLog.details = error.details;
  }

  console.error(`[${context}] Error:`, JSON.stringify(errorLog, null, 2));
}

/**
 * Parse and categorize Supabase errors
 * @param {Object} error - Supabase error object
 * @returns {AppError} Categorized error
 */
export function parseSupabaseError(error) {
  if (!error) {
    return new AppError('Unknown database error', 500, ERROR_CODES.DATABASE_ERROR);
  }

  const errorCode = error.code;
  const errorMapping = SUPABASE_ERROR_MAP[errorCode];

  if (errorMapping) {
    return new AppError(
      errorMapping.message,
      errorMapping.status,
      errorMapping.type,
      { originalError: error.message, code: errorCode }
    );
  }

  // Default database error
  return new AppError(
    error.message || 'Database operation failed',
    500,
    ERROR_CODES.DATABASE_ERROR,
    { code: errorCode }
  );
}

/**
 * Centralized error handler for API routes
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 * @param {Object} metadata - Additional metadata for logging
 * @returns {NextResponse} Error response
 */
export function handleError(error, context = 'API', metadata = {}) {
  // Log the error with context
  logError(error, context, metadata);
  
  // Handle AppError instances
  if (error instanceof AppError) {
    return NextResponse.json(
      { 
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details })
      }, 
      { status: error.statusCode }
    );
  }
  
  // Handle Supabase errors
  if (error.code && error.message) {
    const appError = parseSupabaseError(error);
    return NextResponse.json(
      { 
        error: appError.message,
        code: appError.code,
        ...(appError.details && { details: appError.details })
      }, 
      { status: appError.statusCode }
    );
  }
  
  // Handle JSON parsing errors
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return NextResponse.json(
      { 
        error: 'Invalid JSON in request body',
        code: ERROR_CODES.INVALID_JSON
      }, 
      { status: 400 }
    );
  }
  
  // Generic error fallback
  return NextResponse.json(
    { 
      error: 'Internal server error',
      code: ERROR_CODES.INTERNAL_ERROR,
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
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
    { 
      error: `${resource} not found`,
      code: ERROR_CODES.NOT_FOUND
    },
    { status: 404 }
  );
}

/**
 * Unauthorized error response
 * @param {string} message - Custom error message
 * @returns {NextResponse} 401 response
 */
export function unauthorizedError(message = 'Unauthorized') {
  return NextResponse.json(
    { 
      error: message,
      code: ERROR_CODES.UNAUTHORIZED
    },
    { status: 401 }
  );
}

/**
 * Forbidden error response
 * @param {string} message - Custom error message
 * @returns {NextResponse} 403 response
 */
export function forbiddenError(message = 'Forbidden') {
  return NextResponse.json(
    { 
      error: message,
      code: ERROR_CODES.FORBIDDEN
    },
    { status: 403 }
  );
}

/**
 * Validation error response
 * @param {string|Array} errors - Validation error(s)
 * @returns {NextResponse} 400 response
 */
export function validationError(errors) {
  const errorMessage = Array.isArray(errors) 
    ? errors.join(', ') 
    : errors;
    
  return NextResponse.json(
    { 
      error: 'Validation failed',
      code: ERROR_CODES.VALIDATION_ERROR,
      details: Array.isArray(errors) ? errors : [errors]
    },
    { status: 400 }
  );
}

/**
 * Conflict error response (e.g., duplicate records)
 * @param {string} message - Custom error message
 * @returns {NextResponse} 409 response
 */
export function conflictError(message = 'Resource conflict') {
  return NextResponse.json(
    { 
      error: message,
      code: ERROR_CODES.CONFLICT
    },
    { status: 409 }
  );
}
