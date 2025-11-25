# Course Management Error Handling Improvements

## Overview
This document outlines the comprehensive error handling improvements made to the course management system.

## Files Modified

### 1. Enhanced Error Handler (`/app/lib/middleware/errorHandler.js`)
**New Features:**
- **Structured Error Codes**: Standardized error codes for consistent error handling
  - `VALIDATION_ERROR`: Client-side validation failures
  - `UNAUTHORIZED`: Authentication failures
  - `FORBIDDEN`: Authorization failures
  - `NOT_FOUND`: Resource not found
  - `CONFLICT`: Duplicate or conflicting resources
  - `DATABASE_ERROR`: Database operation failures
  - `INTERNAL_ERROR`: Generic server errors

- **Supabase Error Mapping**: Automatic categorization of database errors
  - `23505`: Unique constraint violation → 409 Conflict
  - `23503`: Foreign key violation → 400 Validation Error
  - `23502`: Not null violation → 400 Validation Error
  - `22P02`: Invalid data format → 400 Validation Error
  - `PGRST116`: Record not found → 404 Not Found

- **Custom AppError Class**: Structured error objects with:
  - HTTP status code
  - Error code
  - Error message
  - Optional details object

- **Structured Logging**: JSON-formatted error logs with:
  - Timestamp
  - Context (API endpoint)
  - Stack trace
  - Error metadata

- **Helper Functions**:
  - `handleError()`: Central error handler
  - `validationError()`: Validation error responses
  - `unauthorizedError()`: 401 responses
  - `forbiddenError()`: 403 responses
  - `notFoundError()`: 404 responses
  - `conflictError()`: 409 responses
  - `parseSupabaseError()`: Database error parser

### 2. Course Validator (`/app/lib/validators/courseValidator.js`)
**Validation Functions:**

- **validateCourseData(data, isUpdate)**:
  - Name: 3-200 characters, string, non-empty
  - Course code: Alphanumeric with hyphens/underscores, max 50 chars
  - Description: 10-5000 characters
  - University: Required string, max 200 chars
  - Duration: Format validation (e.g., "4 weeks", "3 months")
  - Credits: Positive integer, 0-100
  - Category: Required string, max 100 chars
  - Thumbnail URL: Valid HTTP/HTTPS URL
  - Target outcomes: Array with 1-50 items, each max 500 chars

- **validatePagination(page, limit)**:
  - Page: Positive integer
  - Limit: Positive integer, max 100

- **validateApprovalData(data)**:
  - courseId: Required, valid string
  - userId: Required, valid string
  - notes: Optional, max 1000 chars

- **validateRejectionData(data)**:
  - courseId: Required, valid string
  - userId: Required, valid string
  - reason: Required, 10-1000 chars
  - notes: Optional, max 1000 chars

- **sanitizeCourseData(data)**:
  - Trims whitespace
  - Converts course code to uppercase
  - Filters empty outcomes
  - Converts credits to number

### 3. Course API Endpoints

#### GET /api/courses
**Improvements:**
- Pagination validation
- Structured error responses
- Database error categorization
- Context-aware logging

#### POST /api/courses
**Improvements:**
- JSON parsing error handling
- Comprehensive field validation
- Data sanitization before insertion
- Duplicate course code detection (via conflict error)
- Structured success response (201 status)
- Foreign key validation

#### GET /api/courses/[id]
**Improvements:**
- Course ID validation
- Proper 404 handling for non-existent courses
- Database error categorization
- Structured error responses

#### PUT /api/courses/[id]
**Improvements:**
- Course ID validation
- JSON parsing error handling
- Update-specific validation
- Data sanitization
- Proper 404 handling
- Non-blocking audit logging
- Handles already deleted courses

#### DELETE /api/courses/[id]
**Improvements:**
- Course ID validation
- Proper 404 handling
- Prevents double deletion
- Non-blocking audit logging
- Structured success message

#### POST /api/courses/approve
**Improvements:**
- Approval data validation
- Pre-check if course exists
- Prevents double approval
- Fixed column name usage (status vs approval_status)
- Non-blocking audit logging
- Course name included in audit log

#### POST /api/courses/reject
**Improvements:**
- Rejection data validation
- Reason field validation (required, min 10 chars)
- Pre-check if course exists
- Prevents double rejection
- **FIXED BUG**: Changed `.eq('id', courseId)` to `.eq('course_id', courseId)`
- **FIXED BUG**: Changed `approval_status: 'rejected'` to `status: 'Rejected'`
- Non-blocking audit logging
- Course name included in audit log

## Error Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { ... } // Optional
}
```

## Validation Error Response
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    "name must be at least 3 characters long",
    "credits must be a valid number"
  ]
}
```

## HTTP Status Codes Used
- `200`: Success (GET, PUT, DELETE)
- `201`: Created (POST)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication failed)
- `403`: Forbidden (authorization failed)
- `404`: Not Found (resource doesn't exist)
- `409`: Conflict (duplicate resource)
- `500`: Internal Server Error

## Key Improvements

### 1. Consistent Error Handling
- All endpoints use the same error handling utilities
- Standardized error response format
- Predictable HTTP status codes

### 2. Comprehensive Validation
- All input fields validated with specific rules
- Clear, actionable error messages
- Prevents invalid data from reaching the database

### 3. Better Error Categorization
- Database errors mapped to appropriate HTTP status codes
- Duplicate records return 409 instead of 500
- Missing references return 400 instead of 500

### 4. Improved Debugging
- Structured JSON logging
- Context information in logs
- Stack traces for all errors
- Metadata for troubleshooting

### 5. Security Enhancements
- Input sanitization
- SQL injection prevention (via parameterized queries)
- XSS prevention (via data sanitization)

### 6. Non-Blocking Audit Logs
- Audit log failures don't break the main operation
- Errors logged to console for monitoring
- Improves reliability

### 7. Bug Fixes
- Fixed reject endpoint using wrong column names
- Fixed params access in Next.js 15
- Consistent field naming across endpoints

## Testing Recommendations

### Test Cases to Validate

1. **Validation Errors**:
   - Empty required fields
   - Invalid field formats
   - Out-of-range values
   - Invalid URL formats
   - Invalid array structures

2. **Database Errors**:
   - Duplicate course codes
   - Non-existent university references
   - Already deleted courses

3. **Authentication/Authorization**:
   - Missing auth token
   - Invalid auth token
   - Missing user context

4. **Edge Cases**:
   - Very long strings
   - Special characters
   - Unicode characters
   - Null vs undefined values
   - Empty arrays

5. **Success Scenarios**:
   - Create course
   - Update course
   - Delete course
   - Approve course
   - Reject course
   - List courses with filters

## Backward Compatibility
All changes maintain backward compatibility with existing frontend code. The response format has been enhanced but the core structure remains the same.

## Next Steps (Optional Future Enhancements)

1. **Rate Limiting**: Add rate limiting to prevent abuse
2. **Caching**: Implement caching for frequently accessed courses
3. **Batch Operations**: Add bulk approve/reject endpoints
4. **Advanced Search**: Add full-text search capabilities
5. **File Validation**: Validate thumbnail URLs are accessible
6. **Async Validation**: Check for duplicate codes before submission
7. **Audit Trail UI**: Frontend to view audit logs
8. **Error Monitoring**: Integration with Sentry or similar service
9. **API Documentation**: OpenAPI/Swagger documentation
10. **Performance Monitoring**: Track slow queries and optimize
