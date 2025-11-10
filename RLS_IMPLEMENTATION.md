# RLS (Row Level Security) Implementation Guide

## Overview

This document describes the implementation of proper Row Level Security (RLS) context throughout the Rareminds Platform using Supabase.

## Architecture

### Client Types

The application now uses three types of Supabase clients:

| Client | Purpose | RLS | When to Use |
|--------|---------|-----|-------------|
| `rlsClient` | API routes with user context | ✅ Enforced | User-facing operations that should respect RLS policies |
| `supabase` | Legacy client | ✅ Enforced | Read-only public data, no user context needed |
| `supabaseAdmin` | Admin operations | ❌ Bypassed | Platform-wide aggregations, admin-only operations |

### Key Files

1. **`/lib/supabase-rls.js`** - New RLS-aware client factory
2. **`/lib/supabase-server.js`** - Server-side client for Next.js components
3. **`/lib/supabase-browser.js`** - Browser client for client components
4. **`/lib/supabase-admin.js`** - Admin client (bypasses RLS)

## Implementation Details

### 1. RLS Client Factory (`supabase-rls.js`)

```javascript
import { createRLSClient, getUserContext } from '../../../lib/supabase-rls'

// In API routes
const { supabase: rlsClient, user, error } = await createRLSClient(request)
```

**Features:**
- Automatically extracts auth cookies from requests
- Returns authenticated user context
- Creates Supabase client with proper RLS context
- Works in both API routes and server components

### 2. User Context

```javascript
const userContext = await getUserContext(rlsClient, user)

// Returns:
{
  id: 'uuid',
  authId: 'auth-uuid',
  email: 'user@example.com',
  role: 'school_admin',
  entityType: 'school',
  entityId: 'school-uuid',
  organizationId: 'org-uuid',
  organization: { id, name, type },
  isActive: true,
  metadata: { name: 'User Name' },
  name: 'User Name'
}
```

### 3. API Route Pattern

All API routes now follow this pattern:

```javascript
export async function GET(request) {
  const { pathname } = new URL(request.url)
  const path = pathname.replace('/api', '') || '/'

  try {
    // 1. Create RLS-aware client
    const { supabase: rlsClient, user, error: authError } = await createRLSClient(request)
    
    // 2. Check authentication for protected endpoints
    const protectedEndpoints = ['/users', '/recruiters', '/students', '/passports']
    const isProtectedEndpoint = protectedEndpoints.some(endpoint => path.startsWith(endpoint))
    
    if (isProtectedEndpoint && (!user || authError)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 3. Get user context
    let userContext = null
    if (user) {
      userContext = await getUserContext(rlsClient, user)
    }

    // 4. Use rlsClient for database operations
    const { data, error } = await rlsClient
      .from('students')
      .select('*')
      .eq('universityId', userContext.entityId)
    
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

## Updated Endpoints

### User-Facing Endpoints (Using RLS)

These endpoints now use `rlsClient` and respect RLS policies:

#### GET Endpoints:
- ✅ `/api/students` - List students (scoped to user's entity)
- ✅ `/api/passports` - List skill passports (scoped to user's access)
- ✅ `/api/verifications` - List verifications (scoped to user's access)
- ✅ `/api/audit-logs` - List audit logs (scoped to user's access)

#### POST Endpoints:
- ✅ `/api/verify` - Verify passport
- ✅ `/api/suspend-user` - Suspend user
- ✅ `/api/activate-user` - Activate user
- ✅ `/api/reject-passport` - Reject passport

#### PUT Endpoints:
- ✅ `/api/profile` - Update user profile

#### DELETE Endpoints:
- ✅ `/api/user` - Delete user (soft delete)

### Admin Endpoints (Using supabaseAdmin)

These endpoints require platform-wide access and use `supabaseAdmin`:

- ✅ `/api/metrics` - Platform-wide metrics and aggregations
- ✅ `/api/users` - Admin user management (admin_users table)
- ✅ `/api/update-metrics` - Update metrics snapshots

**Why Admin Client?**
- Need to bypass RLS for platform-wide statistics
- Admin operations that manage RLS policies themselves
- Cross-entity aggregations and reports

## RLS Policies Required

For proper RLS implementation, ensure these policies are configured in Supabase:

### 1. Students Table

```sql
-- Platform admins have full access
CREATE POLICY "platform_admin_all" ON students FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.supabase_auth_id = auth.uid() 
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- University admins see their students
CREATE POLICY "university_admin_students" ON students FOR SELECT
USING (
  university_id IN (
    SELECT entity_id FROM users 
    WHERE supabase_auth_id = auth.uid() 
    AND role = 'university_admin'
    AND entity_type = 'university'
  )
);

-- Students see only their own data
CREATE POLICY "student_own_data" ON students FOR SELECT
USING (
  user_id IN (
    SELECT id FROM users 
    WHERE supabase_auth_id = auth.uid()
  )
);
```

### 2. Skill Passports Table

```sql
-- Users can see passports for students in their entity
CREATE POLICY "entity_passports" ON skill_passports FOR SELECT
USING (
  student_id IN (
    SELECT s.id FROM students s
    JOIN users u ON u.id = auth.uid()
    WHERE 
      (u.role = 'platform_admin') OR
      (u.role = 'university_admin' AND s.university_id = u.entity_id) OR
      (u.role = 'student' AND s.user_id = u.id)
  )
);
```

### 3. Audit Logs Table

```sql
-- Users can see audit logs they created or related to their entity
CREATE POLICY "audit_logs_access" ON audit_logs FOR SELECT
USING (
  actor_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);
```

### 4. Users Table

```sql
-- Users can read their own data
CREATE POLICY "users_own_data" ON users FOR SELECT
USING (supabase_auth_id = auth.uid());

-- Users can update their own metadata
CREATE POLICY "users_update_own" ON users FOR UPDATE
USING (supabase_auth_id = auth.uid())
WITH CHECK (supabase_auth_id = auth.uid());

-- Admin users can manage users in their entity
CREATE POLICY "entity_admin_users" ON users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'university_admin', 'school_admin', 'company_admin')
    AND (
      u.role = 'platform_admin' OR
      entity_id = u.entity_id
    )
  )
);
```

## Migration Checklist

- [x] Created `supabase-rls.js` with RLS client factory
- [x] Updated GET handler to use RLS context
- [x] Updated POST handler to use RLS context
- [x] Updated PUT handler to use RLS context
- [x] Updated DELETE handler to use RLS context
- [x] Updated students endpoint
- [x] Updated passports endpoint
- [x] Updated verifications endpoint
- [x] Updated audit-logs endpoint
- [x] Kept admin endpoints using supabaseAdmin
- [x] Added authentication checks
- [x] Added user context extraction
- [ ] Verify RLS policies in Supabase dashboard
- [ ] Test with different user roles
- [ ] Test unauthorized access attempts

## Testing

### 1. Test User-Scoped Access

```javascript
// Login as university admin
// Should only see students from their university
const response = await fetch('/api/students', {
  headers: {
    'Cookie': cookieHeader // Contains auth session
  }
})
```

### 2. Test Role-Based Access

```javascript
// Login as student
// Should only see own data
const response = await fetch('/api/students', {
  headers: {
    'Cookie': cookieHeader
  }
})
```

### 3. Test Admin Access

```javascript
// Login as platform admin
// Should see all data
const response = await fetch('/api/users', {
  headers: {
    'Cookie': cookieHeader
  }
})
```

## Security Benefits

1. **Data Isolation**: Users automatically see only data they're authorized to access
2. **Defense in Depth**: RLS enforced at database level, even if application logic fails
3. **Audit Trail**: All data access respects user context and can be audited
4. **Role-Based**: Different access levels based on user roles
5. **Entity Scoping**: Data automatically scoped to user's organization/entity

## Performance Considerations

1. **Connection Pooling**: RLS clients reuse connections efficiently
2. **Query Optimization**: RLS policies use indexed columns
3. **Caching**: Non-sensitive data can still be cached
4. **Batch Operations**: Bulk queries work with RLS

## Troubleshooting

### Issue: "Unauthorized" errors

**Solution**: Ensure auth cookies are being passed correctly
```javascript
// Check if cookies are present
const cookieHeader = request.headers.get('cookie')
console.log('Cookies:', cookieHeader)
```

### Issue: No data returned

**Solution**: Verify RLS policies allow the user's role
```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'students';
```

### Issue: "User context not found"

**Solution**: Ensure user exists in users table with correct email
```javascript
// Debug user lookup
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', user.email)
console.log('User lookup:', data, error)
```

## Best Practices

1. **Always use rlsClient** for user-facing operations
2. **Only use supabaseAdmin** when absolutely necessary (aggregations, admin ops)
3. **Log all admin operations** for audit purposes
4. **Test with different roles** to ensure proper scoping
5. **Document why** supabaseAdmin is used in specific endpoints
6. **Monitor performance** of RLS queries
7. **Keep policies simple** and well-indexed

## Future Enhancements

1. Add permission-based checks using `hasPermission()` function
2. Implement caching for user context
3. Add RLS policy testing suite
4. Create admin UI for managing RLS policies
5. Add more granular entity-level policies
6. Implement field-level RLS for sensitive data

## Summary

The RLS implementation provides:
- ✅ Automatic data scoping based on user context
- ✅ Role-based access control
- ✅ Entity isolation (schools, universities, companies)
- ✅ Defense against unauthorized access
- ✅ Proper authentication and authorization
- ✅ Audit trail for all operations
- ✅ Scalable and performant architecture

All user-facing endpoints now respect RLS policies, while admin operations that require platform-wide access continue to use the admin client appropriately.
