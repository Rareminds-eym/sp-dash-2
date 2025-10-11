# Supabase Authentication Integration

## Overview
The Rareminds Dashboard now uses **Supabase Auth** for authentication instead of custom JWT sessions. This provides enterprise-grade authentication with built-in security features, session management, and token refresh capabilities.

## Architecture

### Authentication Flow
1. User submits credentials on `/login` page
2. Backend calls `supabase.auth.signInWithPassword()`
3. Supabase Auth validates credentials and creates session
4. Session stored in httpOnly cookies automatically
5. User redirected to `/dashboard`
6. Middleware validates session on every protected route
7. Sessions auto-refresh via Supabase

### Components

#### 1. Server-Side Supabase Client (`/lib/supabase-server.js`)
- Uses `@supabase/ssr` for server-side rendering
- Handles cookie-based sessions
- Used in API routes and server components
- Provides `createClient()`, `getUser()`, `getSession()` helpers

```javascript
import { createClient } from '@/lib/supabase-server'

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

#### 2. Client-Side Supabase Client (`/lib/supabase-browser.js`)
- Uses `@supabase/ssr` for client-side
- Used in client components
- Manages auth state on the client

```javascript
'use client'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
```

#### 3. Middleware (`/middleware.js`)
- Validates Supabase sessions on every request
- Protects dashboard routes
- Handles session refresh automatically
- Redirects based on auth state

### API Endpoints

#### POST `/api/auth/login`
Authenticates user with Supabase Auth.

**Request:**
```json
{
  "email": "superadmin@rareminds.in",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "superadmin@rareminds.in",
    "name": "Super Admin",
    "role": "super_admin",
    "organizationId": "uuid",
    "organization": { ... }
  },
  "session": { ... }
}
```

**Process:**
1. Calls `supabase.auth.signInWithPassword()`
2. Fetches additional user data from `users` table
3. Merges auth user with database user
4. Returns combined user object

#### POST `/api/auth/logout`
Signs out user from Supabase Auth.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Process:**
1. Calls `supabase.auth.signOut()`
2. Clears session cookies
3. Returns success

#### GET `/api/auth/session`
Gets current authenticated user.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "admin",
    "organizationId": "uuid",
    "organization": { ... }
  }
}
```

**Process:**
1. Gets session from Supabase Auth
2. Fetches additional data from `users` table
3. Returns merged user object

## User Management

### Database Schema

#### Supabase Auth (Built-in)
Supabase manages these tables automatically:
- `auth.users` - Core authentication data
- `auth.sessions` - Active sessions
- `auth.refresh_tokens` - Token refresh

User metadata stored in `user_metadata` JSONB field:
```json
{
  "role": "super_admin",
  "name": "Super Admin"
}
```

#### Custom Users Table
Additional application-specific data:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Matches auth.users.id
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,               -- Also in user_metadata for convenience
  "organizationId" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,  -- Stores name, etc.
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Creating Users

#### Setup Script
Use the provided script to create test users:

```bash
node scripts/setup-auth-users.js
```

This script:
1. Creates users in Supabase Auth with passwords
2. Sets user metadata (role, name)
3. Creates corresponding records in `users` table
4. Handles existing users (updates metadata)

#### Manual Creation (via Supabase Dashboard)
1. Go to Authentication > Users in Supabase Dashboard
2. Click "Invite user" or "Add user"
3. Enter email and password
4. Set user metadata:
   ```json
   {
     "role": "admin",
     "name": "Admin User"
   }
   ```
5. Create corresponding record in `users` table

#### Programmatic Creation
```javascript
const { data, error } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'secure-password',
  email_confirm: true,
  user_metadata: {
    role: 'admin',
    name: 'Admin User'
  }
})

// Then create in users table
await supabase.from('users').insert({
  id: data.user.id,
  email: 'user@example.com',
  role: 'admin',
  metadata: { name: 'Admin User' }
})
```

## Test Credentials

The following test users are pre-configured:

| Email | Password | Role |
|-------|----------|------|
| superadmin@rareminds.in | password123 | super_admin |
| admin@rareminds.in | password123 | admin |
| manager@rareminds.in | password123 | manager |

## Security Features

### 1. **httpOnly Cookies**
- Session tokens stored in httpOnly cookies
- Not accessible via JavaScript
- Protects against XSS attacks

### 2. **Automatic Token Refresh**
- Supabase handles token refresh automatically
- Sessions stay valid without manual intervention
- Refresh tokens stored securely

### 3. **Server-Side Validation**
- All auth checks happen on server
- Middleware validates every request
- Cannot be bypassed from client

### 4. **PKCE Flow**
- Supabase uses PKCE (Proof Key for Code Exchange)
- Protects against authorization code interception
- Industry-standard OAuth 2.0 flow

### 5. **Row Level Security (RLS)**
You can enable RLS policies in Supabase:

```sql
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Policy: Admins can read all users
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
```

## Session Management

### Session Lifecycle
1. **Login**: Session created with 1-hour access token and 30-day refresh token
2. **Active Use**: Access token automatically refreshed when expired
3. **Inactivity**: Session expires after 30 days without use
4. **Logout**: Both tokens invalidated immediately

### Session Storage
- Access token: httpOnly cookie (1 hour)
- Refresh token: httpOnly cookie (30 days)
- Cookie names: `sb-access-token`, `sb-refresh-token`

### Configuring Session Duration
Edit Supabase project settings:
1. Go to Authentication > Settings
2. Under "JWT Settings":
   - **JWT expiry**: Access token lifetime (default: 3600s = 1 hour)
   - **Refresh token rotation**: Enable for added security
3. Under "Auth URL Configuration":
   - Set site URL to your production domain

## Password Reset

### Implementing Password Reset
```javascript
// Request password reset
const { error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  {
    redirectTo: 'https://yourdomain.com/reset-password'
  }
)

// Handle reset in reset-password page
const { error } = await supabase.auth.updateUser({
  password: 'new-secure-password'
})
```

### Reset Email Template
Customize in Supabase Dashboard:
1. Go to Authentication > Email Templates
2. Edit "Reset Password" template
3. Customize subject, body, and styling

## Email Verification

### Enabling Email Verification
1. In Supabase Dashboard: Authentication > Settings
2. Enable "Confirm email"
3. Users must verify email before logging in

### Custom Email Templates
Customize in Supabase Dashboard:
1. Authentication > Email Templates
2. Edit "Confirm signup" template
3. Set redirect URL after confirmation

## Multi-Factor Authentication (MFA)

Supabase supports MFA out of the box:

```javascript
// Enroll MFA
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp'
})

// Verify MFA
const { data, error } = await supabase.auth.mfa.verify({
  factorId: data.id,
  code: '123456'
})
```

## Social Authentication

Add social providers in Supabase Dashboard:

1. Authentication > Providers
2. Enable provider (Google, GitHub, etc.)
3. Add OAuth credentials
4. Update login page:

```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google'
})
```

## Environment Variables

Required variables in `.env`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Never expose** `SUPABASE_SERVICE_ROLE_KEY` to client-side code!

## Troubleshooting

### "Invalid login credentials"
- Check email/password are correct
- Verify user exists in Supabase Auth
- Check if email verification is required

### "Session expired"
- Session may have expired (30 days)
- Try logging in again
- Check if refresh token is being sent

### "No session found"
- Cookies may be blocked
- Check browser cookie settings
- Verify middleware is not blocking cookies

### Users not syncing to database
- Run `node scripts/setup-auth-users.js`
- Check if `users` table exists
- Verify user IDs match between auth and database

## Best Practices

1. **Always use server-side client for sensitive operations**
   - Use `/lib/supabase-server.js` in API routes
   - Never expose service role key to client

2. **Implement proper error handling**
   - Handle auth errors gracefully
   - Provide clear error messages to users
   - Log errors for debugging

3. **Enable email verification in production**
   - Prevents fake accounts
   - Validates user emails
   - Improves security

4. **Use environment-specific secrets**
   - Different keys for dev/staging/prod
   - Rotate keys regularly
   - Store securely (not in git)

5. **Monitor authentication logs**
   - Check Supabase Dashboard > Authentication > Logs
   - Set up alerts for suspicious activity
   - Review failed login attempts

6. **Enable RLS policies**
   - Protect sensitive data
   - Enforce authorization at database level
   - Prevent unauthorized access

## Migration from Custom Auth

If migrating from custom authentication:

1. **Export existing users**
2. **Create in Supabase Auth** using admin API
3. **Update IDs** in your database tables
4. **Test thoroughly** with staging data
5. **Migrate in batches** for large user bases

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side)
- [Next.js + Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

---

**Status**: ✅ Fully integrated and functional
**Last Updated**: Current session
