# Database Architecture - sp-dash-2

## Overview

The `sp-dash-2` dashboard connects to **two separate databases**:

1. **SSO Auth Database** - For authentication (users, sessions, subscriptions)
2. **SkillPassport Database** - For application data (courses, passports, assessments)

```
┌─────────────────────────────────────────────────────────────┐
│  sp-dash-2 Dashboard (Next.js)                              │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
            │ Authentication                  │ Application Data
            │ (via SSO Worker)                │ (Direct Access)
            ▼                                 ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│  SSO Worker             │     │  SkillPassport Database     │
│  (Cloudflare Worker)    │     │  (Supabase)                 │
│         │               │     │  - courses                  │
│         ▼               │     │  - passports                │
│  SSO Auth Database      │     │  - assessments              │
│  (Supabase)             │     │  - learner_profiles         │
│  - users                │     │  - admin_users              │
│  - sessions             │     │  - universities             │
│  - subscriptions        │     │  - recruiters               │
│  - plans                │     │  - colleges                 │
└─────────────────────────┘     └─────────────────────────────┘
```

---

## Database Clients

### 1. **SkillPassport Database Client** (Primary)

**File**: `lib/supabase-admin.js`

```javascript
import { supabaseAdmin } from '@/lib/supabase-admin'

// Use for all application data queries
const { data: courses } = await supabaseAdmin
  .from('courses')
  .select('*')
```

**Use Cases**:
- ✅ Fetch courses
- ✅ Fetch passports
- ✅ Fetch assessments
- ✅ Fetch universities, colleges, recruiters
- ✅ Create/Update/Delete application data
- ✅ Query admin_users table

**Environment Variables**:
```bash
SKILLPASSPORT_SUPABASE_URL=https://dpooleduinyyzxgrcwko.supabase.co
SKILLPASSPORT_SERVICE_ROLE_KEY=your_service_role_key
```

---

### 2. **SSO Auth Database Client** (Optional)

**File**: `lib/supabase-admin.js`

```javascript
import { ssoAuthAdmin } from '@/lib/supabase-admin'

// Only use if you need direct access to SSO auth database
if (ssoAuthAdmin) {
  const { data: subscription } = await ssoAuthAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
}
```

**Use Cases**:
- ⚠️ Direct subscription queries (prefer SSO Worker API)
- ⚠️ Direct user queries (prefer SSO Worker API)
- ⚠️ Direct session queries (prefer SSO Worker API)

**Environment Variables**:
```bash
SSO_AUTH_SUPABASE_URL=http://127.0.0.1:54331
SSO_AUTH_SERVICE_ROLE_KEY=your_service_role_key
```

**⚠️ Important**: For most authentication-related queries, use the **SSO Worker API** instead of direct database access.

---

## Authentication Flow

### **Login Process**

```javascript
// 1. User submits login form
POST /api/auth/sso-login
{
  email: "user@example.com",
  password: "password123"
}

// 2. Dashboard calls SSO Worker
fetch('http://localhost:8788/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
})

// 3. SSO Worker validates credentials against SSO Auth Database
// 4. SSO Worker returns JWT + user data
// 5. Dashboard sets cookies and returns success
```

### **Protected API Route**

```javascript
// app/api/courses/route.js
import { authenticateSSORequest } from '@/lib/middleware/sso-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request) {
  // 1. Validate SSO session
  const { error, user } = await authenticateSSORequest(request, ['super_admin', 'admin'])
  if (error) return error
  
  // 2. Query SkillPassport database
  const { data: courses } = await supabaseAdmin
    .from('courses')
    .select('*')
  
  return NextResponse.json({ data: courses })
}
```

---

## Data Flow Examples

### **Example 1: Fetch Courses**

```javascript
// API Route: app/api/courses/route.js
export async function GET(request) {
  // Authenticate via SSO
  const { error, user } = await authenticateSSORequest(request, ['super_admin', 'admin'])
  if (error) return error
  
  // Fetch from SkillPassport DB
  const { data: courses } = await supabaseAdmin
    .from('courses')
    .select('*')
    .eq('status', 'Active')
  
  return NextResponse.json({ data: courses })
}
```

**Database**: SkillPassport ✅  
**Table**: `courses`  
**Client**: `supabaseAdmin`

---

### **Example 2: Create Course**

```javascript
// API Route: app/api/courses/route.js
export async function POST(request) {
  // Authenticate via SSO
  const { error, user } = await authenticateSSORequest(request, ['super_admin', 'admin'])
  if (error) return error
  
  const body = await request.json()
  
  // Insert into SkillPassport DB
  const { data: course } = await supabaseAdmin
    .from('courses')
    .insert({
      title: body.name,
      code: body.course_code,
      educator_id: user.id, // user.id from SSO auth
      status: 'Draft'
    })
    .select()
    .single()
  
  return NextResponse.json({ success: true, data: course })
}
```

**Database**: SkillPassport ✅  
**Table**: `courses`  
**Client**: `supabaseAdmin`  
**User ID**: From SSO auth (user.id)

---

### **Example 3: Fetch User Subscription** (via SSO Worker)

```javascript
// API Route: app/api/user/subscription/route.js
export async function GET(request) {
  // Authenticate via SSO
  const { error, user } = await authenticateSSORequest(request, ['super_admin', 'admin'])
  if (error) return error
  
  // Call SSO Worker API (preferred method)
  const ssoWorkerUrl = process.env.SSO_WORKER_URL
  const response = await fetch(`${ssoWorkerUrl}/subscriptions/${user.id}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })
  
  const subscription = await response.json()
  
  return NextResponse.json({ data: subscription })
}
```

**Database**: SSO Auth (via SSO Worker) ✅  
**Table**: `subscriptions`  
**Method**: SSO Worker API (not direct DB access)

---

### **Example 4: Fetch Passports with User Info**

```javascript
// API Route: app/api/passports/route.js
export async function GET(request) {
  // Authenticate via SSO
  const { error, user } = await authenticateSSORequest(request, ['super_admin', 'admin'])
  if (error) return error
  
  // Fetch from SkillPassport DB
  const { data: passports } = await supabaseAdmin
    .from('passports')
    .select(`
      *,
      users!inner(id, email, firstName, lastName)
    `)
    .eq('status', 'verified')
  
  return NextResponse.json({ data: passports })
}
```

**Database**: SkillPassport ✅  
**Tables**: `passports`, `users` (joined)  
**Client**: `supabaseAdmin`

---

## Environment Configuration

### **Local Development**

```bash
# .env.local

# SSO Worker (Authentication)
SSO_WORKER_URL=http://localhost:8788

# SSO Auth Database (via SSO Worker)
SSO_AUTH_SUPABASE_URL=http://127.0.0.1:54331
SSO_AUTH_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# SkillPassport Database (Application Data)
SKILLPASSPORT_SUPABASE_URL=http://127.0.0.1:54331
SKILLPASSPORT_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Production**

```bash
# .env.production

# SSO Worker (Authentication)
SSO_WORKER_URL=https://sso-api.your-domain.workers.dev

# SSO Auth Database (via SSO Worker)
SSO_AUTH_SUPABASE_URL=https://your-sso-auth.supabase.co
SSO_AUTH_SERVICE_ROLE_KEY=your_production_key

# SkillPassport Database (Application Data)
SKILLPASSPORT_SUPABASE_URL=https://dpooleduinyyzxgrcwko.supabase.co
SKILLPASSPORT_SERVICE_ROLE_KEY=your_production_key
```

---

## Database Tables Reference

### **SSO Auth Database** (Access via SSO Worker)

| Table | Purpose | Access Method |
|-------|---------|---------------|
| `users` | User accounts | SSO Worker API |
| `sessions` | Active sessions | SSO Worker API |
| `subscriptions` | User subscriptions | SSO Worker API |
| `plans` | Subscription plans | SSO Worker API |
| `organizations` | Organizations | SSO Worker API |

### **SkillPassport Database** (Direct Access)

| Table | Purpose | Access Method |
|-------|---------|---------------|
| `courses` | Course catalog | `supabaseAdmin` |
| `passports` | Student passports | `supabaseAdmin` |
| `assessments` | Assessments | `supabaseAdmin` |
| `learner_profiles` | Student profiles | `supabaseAdmin` |
| `admin_users` | Admin roles | `supabaseAdmin` |
| `universities` | Universities | `supabaseAdmin` |
| `colleges` | Colleges | `supabaseAdmin` |
| `recruiters` | Recruiters | `supabaseAdmin` |
| `users` | User metadata | `supabaseAdmin` |

---

## Best Practices

### ✅ **DO:**

1. **Use `supabaseAdmin` for all application data**
   ```javascript
   const { data } = await supabaseAdmin.from('courses').select('*')
   ```

2. **Use SSO Worker API for authentication data**
   ```javascript
   const response = await fetch(`${SSO_WORKER_URL}/subscriptions/${userId}`)
   ```

3. **Always authenticate before database queries**
   ```javascript
   const { error, user } = await authenticateSSORequest(request)
   if (error) return error
   ```

4. **Use user.id from SSO auth for foreign keys**
   ```javascript
   await supabaseAdmin.from('courses').insert({
     educator_id: user.id // From SSO auth
   })
   ```

### ❌ **DON'T:**

1. **Don't query SSO Auth DB directly** (use SSO Worker API)
   ```javascript
   // ❌ Bad
   const { data } = await ssoAuthAdmin.from('subscriptions').select('*')
   
   // ✅ Good
   const response = await fetch(`${SSO_WORKER_URL}/subscriptions/${userId}`)
   ```

2. **Don't mix up database clients**
   ```javascript
   // ❌ Bad - trying to query courses from SSO Auth DB
   const { data } = await ssoAuthAdmin.from('courses').select('*')
   
   // ✅ Good - query courses from SkillPassport DB
   const { data } = await supabaseAdmin.from('courses').select('*')
   ```

3. **Don't skip authentication**
   ```javascript
   // ❌ Bad - no auth check
   export async function GET(request) {
     const { data } = await supabaseAdmin.from('courses').select('*')
     return NextResponse.json({ data })
   }
   
   // ✅ Good - authenticate first
   export async function GET(request) {
     const { error, user } = await authenticateSSORequest(request)
     if (error) return error
     const { data } = await supabaseAdmin.from('courses').select('*')
     return NextResponse.json({ data })
   }
   ```

---

## Migration Checklist

When migrating existing code to use SkillPassport database:

- [ ] Update `lib/supabase-admin.js` to use `SKILLPASSPORT_SUPABASE_URL`
- [ ] Update `.env.local` with SkillPassport credentials
- [ ] Verify all API routes use `supabaseAdmin` for application data
- [ ] Verify all API routes use SSO Worker API for auth data
- [ ] Test CRUD operations (Create, Read, Update, Delete)
- [ ] Test authentication flow
- [ ] Test role-based access control
- [ ] Update production environment variables

---

## Troubleshooting

### **Issue: "relation does not exist"**

**Cause**: Querying wrong database (e.g., querying `courses` from SSO Auth DB)

**Solution**: Use correct client
```javascript
// ✅ Correct
const { data } = await supabaseAdmin.from('courses').select('*')
```

### **Issue: "Unauthorized" errors**

**Cause**: Missing or invalid SSO session

**Solution**: Check authentication middleware
```javascript
const { error, user } = await authenticateSSORequest(request)
if (error) return error
```

### **Issue: "Cannot find user"**

**Cause**: User exists in SSO Auth DB but not in SkillPassport DB

**Solution**: Ensure user record exists in both databases
```javascript
// Check if user exists in SkillPassport DB
const { data: user } = await supabaseAdmin
  .from('users')
  .select('id')
  .eq('id', ssoUser.id)
  .single()

if (!user) {
  // Create user record in SkillPassport DB
  await supabaseAdmin.from('users').insert({
    id: ssoUser.id,
    email: ssoUser.email
  })
}
```

---

## Summary

- **Authentication**: SSO Worker → SSO Auth Database
- **Application Data**: Direct Access → SkillPassport Database
- **User ID**: Comes from SSO auth, used as foreign key in SkillPassport DB
- **Best Practice**: Use `supabaseAdmin` for all application queries
