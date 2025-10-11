# Next.js Routing Structure - Rareminds Dashboard

## Overview
The application has been converted from a single-page application to a proper Next.js routing structure with secure session management and middleware-based authentication.

## Route Structure

### Public Routes
- **`/`** → Redirects to `/dashboard`
- **`/login`** → Authentication page

### Protected Routes (Dashboard)
All routes under `(dashboard)` group are protected by middleware and require authentication:

- **`/dashboard`** → Main dashboard with metrics and analytics
- **`/users`** → User management page
- **`/passports`** → Skill passports management
- **`/reports`** → Reports & Analytics with 5 tabs
- **`/audit-logs`** → Audit logs history
- **`/integrations`** → Third-party integrations
- **`/settings`** → Application settings

## File Structure

```
/app/
├── app/
│   ├── layout.js                          # Root layout (ThemeProvider)
│   ├── page.js                            # Root page (redirects to /dashboard)
│   │
│   ├── login/
│   │   └── page.js                        # Login page
│   │
│   ├── (dashboard)/                       # Route group for authenticated pages
│   │   ├── layout.js                      # Dashboard layout with sidebar/header
│   │   ├── dashboard/page.js              # Dashboard page
│   │   ├── users/page.js                  # Users management page
│   │   ├── passports/page.js              # Passports management page
│   │   ├── reports/page.js                # Reports & Analytics page
│   │   ├── audit-logs/page.js             # Audit logs page
│   │   ├── integrations/page.js           # Integrations page
│   │   └── settings/page.js               # Settings page
│   │
│   └── api/
│       ├── auth/
│       │   ├── login/route.js             # POST /api/auth/login
│       │   ├── logout/route.js            # POST /api/auth/logout
│       │   └── session/route.js           # GET /api/auth/session
│       └── [[...path]]/route.js           # Existing backend APIs
│
├── middleware.js                           # Route protection middleware
│
├── lib/
│   ├── session.js                          # Session management utilities
│   ├── supabase.js                         # Supabase client
│   └── supabase-admin.js                   # Supabase admin client
│
└── components/
    ├── pages/                              # Page components (reused in routes)
    │   ├── Dashboard.js
    │   ├── UsersPage.js
    │   ├── PassportsPage.js
    │   ├── ReportsPage.js
    │   ├── AuditLogsPage.js
    │   ├── IntegrationsPage.js
    │   └── SettingsPage.js
    └── ui/                                 # Reusable UI components
```

## Authentication & Session Management

### Session Management (`/lib/session.js`)
- **JWT-based sessions** using `jose` library
- **httpOnly cookies** for secure session storage
- **24-hour session expiration**
- Server-side session encryption/decryption

### Authentication Flow
1. User submits credentials on `/login`
2. API validates against Supabase users table
3. Server creates encrypted session and sets httpOnly cookie
4. User redirected to `/dashboard`
5. Middleware validates session on each protected route access
6. Session auto-refreshed on valid requests

### Middleware Protection (`/middleware.js`)
- Protects all dashboard routes
- Redirects unauthenticated users to `/login`
- Redirects authenticated users away from `/login`
- Runs on all routes except API, static files, and images

## API Endpoints

### Authentication APIs
- **POST** `/api/auth/login` - Authenticate user and create session
- **POST** `/api/auth/logout` - Destroy session and logout
- **GET** `/api/auth/session` - Get current user session

### Existing Backend APIs (unchanged)
All existing APIs remain functional under `/api/`:
- `/api/metrics` - Dashboard metrics
- `/api/analytics-trends` - Analytics trends data
- `/api/analytics-statewise` - State-wise analytics
- `/api/users` - User management
- `/api/organizations` - Organization management
- `/api/students` - Student management
- `/api/passports` - Skill passports
- `/api/verifications` - Verification history
- `/api/audit-logs` - Audit logs
- `/api/university-reports` - University analytics
- `/api/recruiter-metrics` - Recruiter metrics
- `/api/placement-conversion` - Placement conversion data
- `/api/state-heatmap` - State heatmap data
- `/api/ai-insights` - AI insights data
- And more...

## Database

### Supabase (PostgreSQL)
All data operations use Supabase client:
- No MongoDB references in codebase
- Existing database schema maintained
- All tables and relationships unchanged

### Key Tables
- `users` - User accounts and roles
- `organizations` - Universities and recruiters
- `students` - Student records
- `skill_passports` - Skill verification passports
- `verifications` - Verification records
- `audit_logs` - System audit trail
- `metrics_snapshots` - Dashboard metrics cache

## Key Features

### 1. **Proper Next.js Routing**
- File-based routing with route groups
- Separate layouts for public and protected routes
- Server-side rendering where applicable

### 2. **Secure Authentication**
- JWT-based sessions with encryption
- httpOnly cookies (not accessible via JavaScript)
- Server-side session validation
- Automatic session refresh

### 3. **Route Protection**
- Middleware-based authentication check
- Automatic redirects for unauthorized access
- Protected dashboard routes
- Public login route

### 4. **Layout Hierarchy**
- Root layout: Theme provider, global styles
- Dashboard layout: Sidebar, header, navigation
- Page-specific layouts as needed

### 5. **Preserved Functionality**
- All existing page components reused
- No design changes
- All API endpoints functional
- Database operations unchanged

## Navigation

### Sidebar Navigation
The dashboard layout provides sidebar navigation with the following items:
1. Dashboard
2. Users
3. Passports
4. Reports
5. Audit Logs
6. Integrations
7. Settings

Each nav item links to its respective route using Next.js `<Link>` component for client-side navigation.

## Security Improvements

1. **Session Storage**: Moved from localStorage to httpOnly cookies
2. **Server-Side Validation**: Sessions validated on server, not client
3. **Middleware Protection**: All routes checked before rendering
4. **JWT Encryption**: Session data encrypted with HS256 algorithm
5. **Automatic Expiration**: Sessions expire after 24 hours
6. **Secure Cookie Settings**: 
   - httpOnly: true (not accessible via JS)
   - secure: true (in production, HTTPS only)
   - sameSite: 'lax' (CSRF protection)

## Environment Variables

Required environment variable in `/app/.env`:
```
SESSION_SECRET=rareminds-super-secret-key-change-in-production-2024
```

Note: In production, use a strong random secret key.

## Testing Credentials

As per the existing setup:
- Super Admin: `superadmin@rareminds.in`
- Admin: `admin@rareminds.in`
- Manager: `manager@rareminds.in`
- Password: Any password (demo mode)

## Migration Notes

### What Changed
1. ✅ Converted from single-page app to multi-route structure
2. ✅ Implemented proper Next.js layouts
3. ✅ Added secure session management
4. ✅ Created authentication middleware
5. ✅ Removed localStorage dependency
6. ✅ Added JWT-based authentication

### What Stayed the Same
1. ✅ All page components unchanged
2. ✅ All UI/UX design preserved
3. ✅ All backend APIs functional
4. ✅ Supabase database connections
5. ✅ Theme switching functionality
6. ✅ All existing features working

## Development

### Running the Application
```bash
cd /app
yarn dev
```

The application will start on `http://localhost:3000`

### Restarting Services
```bash
sudo supervisorctl restart nextjs
```

### Checking Logs
```bash
tail -f /var/log/supervisor/nextjs.*.log
```

## Production Considerations

1. Change `SESSION_SECRET` to a strong random key
2. Ensure `NODE_ENV=production` is set
3. Enable secure cookies (automatic in production)
4. Implement password hashing for user authentication
5. Add rate limiting for login attempts
6. Consider Redis for session storage at scale
7. Enable HTTPS for all connections

---

**Last Updated**: Current session
**Status**: ✅ Fully functional and tested
**Database**: Supabase (PostgreSQL) - No MongoDB
