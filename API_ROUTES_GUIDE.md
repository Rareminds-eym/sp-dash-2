# API Routes Guide - Modularized Structure

This document provides a complete guide to the modularized API structure of the Rareminds Platform.

## Quick Reference

### Core Resources

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/metrics` | `/app/app/api/metrics/route.js` | Dashboard metrics |
| `GET /api/organizations` | `/app/app/api/organizations/route.js` | Combined universities & recruiters list |

### User Management

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/users` | `/app/app/api/users/route.js` | List admin users with pagination |
| `GET /api/users/organizations` | `/app/app/api/users/organizations/route.js` | Organizations for filter dropdown |

### Recruiters

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/recruiters` | `/app/app/api/recruiters/route.js` | List recruiters with filters |
| `GET /api/recruiters/[id]` | `/app/app/api/recruiters/[id]/route.js` | Single recruiter detail |
| `GET /api/recruiters/export` | `/app/app/api/recruiters/export/route.js` | Export recruiters to CSV |
| `GET /api/recruiters/states` | `/app/app/api/recruiters/states/route.js` | Unique states for filtering |

### Universities

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/universities` | `/app/app/api/universities/route.js` | List universities with pagination |

### Colleges

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/colleges` | `/app/app/api/colleges/route.js` | List colleges with filters |

### Students

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/students` | `/app/app/api/students/route.js` | List students with pagination |

### Skill Passports (AI Insights)

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/passports` | `/app/app/api/passports/route.js` | List skill passports with filters |
| `GET /api/passports/universities` | `/app/app/api/passports/universities/route.js` | Universities for filtering |
| `GET /api/passports/export` | `/app/app/api/passports/export/route.js` | Export passports to CSV |

### Verifications

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/verifications` | `/app/app/api/verifications/route.js` | Recent verifications list |

### Audit Logs

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/audit-logs` | `/app/app/api/audit-logs/route.js` | List audit logs with filters |
| `GET /api/audit-logs/export` | `/app/app/api/audit-logs/export/route.js` | Export logs to CSV |
| `GET /api/audit-logs/actions` | `/app/app/api/audit-logs/actions/route.js` | Unique action types |
| `GET /api/audit-logs/users` | `/app/app/api/audit-logs/users/route.js` | Users who performed actions |

### Analytics

| Endpoint | File Path | Description |
|----------|-----------|-------------|
| `GET /api/analytics/state-wise` | `/app/app/api/analytics/state-wise/route.js` | State-wise distribution |
| `GET /api/analytics/trends` | `/app/app/api/analytics/trends/route.js` | Employability trends |
| `GET /api/analytics/university-reports` | `/app/app/api/analytics/university-reports/route.js` | University analytics |
| `GET /api/analytics/recruiter-metrics` | `/app/app/api/analytics/recruiter-metrics/route.js` | Recruiter engagement |

## Common Query Parameters

### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

### Filtering
- `status` - Filter by status
- `search` - Search term (fuzzy search enabled)
- `sortBy` - Field to sort by
- `sortOrder` - Sort direction (`asc` or `desc`)

### Examples

```bash
# Get metrics
curl http://localhost:3000/api/metrics

# List recruiters with pagination
curl "http://localhost:3000/api/recruiters?page=1&limit=10"

# Search for universities
curl "http://localhost:3000/api/universities?search=oxford"

# Filter passports by status
curl "http://localhost:3000/api/passports?status=verified"

# Export audit logs
curl "http://localhost:3000/api/audit-logs/export" -o audit-logs.csv
```

## Shared Services

### Audit Service (`/app/lib/services/auditService.js`)

```javascript
import { logAudit } from '@/lib/services/auditService';

await logAudit(userId, 'UPDATE_RECRUITER', recruiterId, { changes }, ipAddress);
```

### Cache Service (`/app/lib/services/cacheService.js`)

```javascript
import { addCacheHeaders } from '@/lib/services/cacheService';

const response = NextResponse.json(data);
return addCacheHeaders(response, 'static'); // or 'dynamic', 'private', 'no-cache'
```

### Export Service (`/app/lib/services/exportService.js`)

```javascript
import { generateCSV, createCSVResponse } from '@/lib/services/exportService';

const headers = ['Name', 'Email', 'Status'];
const rows = data.map(item => [item.name, item.email, item.status]);
const csv = generateCSV(headers, rows);
return createCSVResponse(csv, 'export.csv');
```

### Metrics Service (`/app/lib/services/metricsService.js`)

```javascript
import { getDashboardMetrics } from '@/lib/services/metricsService';

const metrics = await getDashboardMetrics(rlsClient);
```

## Shared Middleware

### Authentication Middleware (`/app/lib/middleware/auth.js`)

```javascript
import { authenticateRequest } from '@/lib/middleware/auth';

const { rlsClient, user, userContext, error } = await authenticateRequest(
  request, 
  ['/protected-path']
);

if (error) return error;
```

### Error Handler (`/app/lib/middleware/errorHandler.js`)

```javascript
import { handleError, notFoundError } from '@/lib/middleware/errorHandler';

try {
  // Your code
} catch (error) {
  return handleError(error, 'Context Name');
}

// Or for 404s
if (!resource) {
  return notFoundError('Resource Name');
}
```

## Adding New Routes

To add a new modularized route:

1. **Create route file** in appropriate directory:
   ```
   /app/app/api/your-resource/route.js
   ```

2. **Use the standard pattern**:
   ```javascript
   import { NextResponse } from 'next/server';
   import { authenticateRequest } from '@/lib/middleware/auth';
   import { handleError } from '@/lib/middleware/errorHandler';
   import { addCacheHeaders } from '@/lib/services/cacheService';
   
   export const runtime = 'edge';
   
   export async function GET(request) {
     try {
       const { rlsClient, error } = await authenticateRequest(request);
       if (error) return error;
       
       // Your logic here
       const data = await fetchData();
       
       const response = NextResponse.json(data);
       return addCacheHeaders(response, 'static');
     } catch (error) {
       return handleError(error, 'YourResource');
     }
   }
   ```

3. **Test the route**:
   ```bash
   curl http://localhost:3000/api/your-resource
   ```

## Edge Runtime

All API routes use the Edge runtime for better performance:

```javascript
export const runtime = 'edge';
```

This provides:
- Faster cold starts
- Lower latency
- Better scalability
- Cost efficiency

## Best Practices

1. **Always use middleware**
   - Use `authenticateRequest` for protected routes
   - Use `handleError` for consistent error handling

2. **Apply appropriate caching**
   - `static` - For rarely changing data (5 min)
   - `dynamic` - For frequently changing data (1 min)
   - `private` - For user-specific data (30 sec)
   - `no-cache` - For write operations

3. **Use services for shared logic**
   - Keep route handlers thin
   - Extract complex logic to services
   - Reuse code across routes

4. **Follow naming conventions**
   - Use kebab-case for route folders
   - Use descriptive names
   - Group related routes in folders

5. **Document your routes**
   - Add JSDoc comments
   - Update this guide
   - Include example requests

## Troubleshooting

### Route not found (404)
- Check file structure matches URL
- Verify file is named `route.js`
- Ensure correct HTTP method is exported

### Authentication errors
- Check if route needs auth middleware
- Verify user has correct permissions
- Check RLS policies in Supabase

### Cache issues
- Check cache headers in response
- Clear browser cache
- Verify cache type is appropriate

### Performance issues
- Check database query efficiency
- Verify proper indexing
- Consider pagination
- Review RLS policies

## Security Considerations

1. **Always authenticate protected routes**
2. **Use RLS client for data access**
3. **Validate all input data**
4. **Log sensitive operations**
5. **Apply rate limiting** (configure at proxy level)
6. **Use HTTPS in production**

## Testing

### Manual Testing
```bash
# Test GET endpoint
curl -X GET http://localhost:3000/api/metrics

# Test with auth
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test with query params
curl -X GET "http://localhost:3000/api/recruiters?page=2&limit=5"
```

### Using Next.js Testing Tools
Refer to `/app/tests/` directory for automated test examples.

## Monitoring

- Check Next.js logs: `tail -f /var/log/supervisor/nextjs.*.log`
- Monitor API performance via `/api/metrics`
- Review audit logs for security
- Track error rates in error handler

## Future Improvements

- [ ] Add OpenAPI/Swagger documentation
- [ ] Implement rate limiting middleware
- [ ] Add request validation middleware (Zod)
- [ ] Create automated tests for all routes
- [ ] Add API versioning (v1, v2)
- [ ] Implement response compression
- [ ] Add request logging middleware
