# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rareminds Platform Admin Dashboard - A Next.js 15 application for managing schools, colleges, universities, companies, students, and recruiters. Built with Next.js App Router, Supabase, and deployed on Cloudflare Pages.

**Development Environment**: `https://dev.sp-dash-2.pages.dev/`

## Development Commands

```bash
# Development
npm run dev              # Start dev server on 0.0.0.0:3000 with memory optimization
npm run dev:no-reload    # Dev server without fast refresh
npm run dev:webpack      # Dev server with webpack (default mode)

# Building & Deployment
npm run build            # Build Next.js for production
npm run cf-build         # Build for Cloudflare Pages deployment
npm start                # Start production server

# Package Manager
yarn                     # This project uses Yarn 1.22.22
```

## Architecture

### Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **UI**: Radix UI primitives + shadcn/ui components + Tailwind CSS
- **State Management**: React Context + hooks
- **Forms**: React Hook Form + Zod validation
- **Deployment**: Cloudflare Pages (with Workers support)
- **Authentication**: Supabase Auth with JWT

### Directory Structure

```
app/
├── (dashboard)/              # Protected dashboard routes
│   ├── approvals/           # Entity approval management
│   ├── audit-logs/          # Audit trail viewer
│   ├── dashboard/           # Main dashboard
│   ├── integrations/        # External integrations
│   ├── passports/           # Student passport management
│   ├── reports/             # Analytics & reporting
│   ├── settings/            # App settings
│   ├── users/               # User management
│   └── layout.js           # Dashboard shell layout
├── api/                     # Next.js API routes
│   ├── analytics/          # Analytics endpoints
│   ├── auth/               # Authentication endpoints
│   ├── colleges/           # College CRUD operations
│   ├── organizations/      # Organization management
│   ├── passports/          # Passport operations
│   ├── recruiters/         # Recruiter management
│   ├── students/           # Student operations
│   ├── universities/       # University CRUD
│   └── users/              # User management APIs
├── login/                   # Public login page
├── reset-password/          # Password reset flow
├── globals.css             # Global styles + Tailwind
└── layout.js               # Root layout

components/
├── approvals/              # Approval center components
│   ├── views/              # Multiple display types (Card, Table, List, Compact)
│   ├── ApprovalViewSwitcher.js
│   ├── ApprovalSearchFilter.js
│   └── EntityCard.js
├── charts/                 # Recharts visualization components
├── pages/                  # Page-level components
├── sections/               # Dashboard sections
└── ui/                     # shadcn/ui components

lib/
├── rbac.js                 # Role-based access control utilities
├── supabase.js             # Supabase client initialization
├── supabase-server.js      # Server-side Supabase client
├── supabase-rls.js         # Row-level security helpers
├── data-fetchers.js        # Reusable data fetching functions
└── search-utils.js         # Search & filter utilities

database/
└── migrations/             # SQL migration files
```

### Key Architectural Patterns

1. **Supabase Integration**: All database operations go through Supabase client, never direct SQL from frontend
2. **RBAC System**: Role-based permissions checked via `lib/rbac.js` for all operations
3. **Row-Level Security**: Database policies enforce access control at DB level
4. **Server Components**: Use Server Components for data fetching, Client Components only when needed
5. **API Routes**: Next.js API routes proxy to Supabase, handle auth and validation
6. **Modular Components**: Approval center demonstrates component modularization pattern

### Authentication & Authorization

- **Middleware**: `/middleware.js` protects routes, validates JWT tokens
- **Protected Routes**: `/dashboard/*`, `/users/*`, `/passports/*`, `/recruiters/*`, `/reports/*`, `/audit-logs/*`, `/integrations/*`, `/settings/*`
- **Public Routes**: `/login`, `/reset-password`
- **RBAC**: `getUserPermissions()`, `hasPermission()`, `requirePermission()` functions in `lib/rbac.js`
- **Admin Roles**: Stored in `admin_users` table with `admin_role` field
- **Permissions**: Defined in `permissions` and `role_permissions` tables

### Database Schema

Key entities and relationships (see `ARCHITECTURE.md` for full schema):

- **Users**: Central auth table (extends Supabase auth.users)
- **Schools**: Educational institutions with classes and educators
- **Colleges**: Standalone or university-affiliated
- **Universities**: Parent entities with multiple colleges
- **Companies**: Organizations with branches and recruiters
- **Students**: Can belong to schools, colleges, or universities
- **Recruiters**: Belong to companies
- **Role Hierarchy**: platform_admin > entity admins > managers > educators/lecturers > students/recruiters

## Configuration

### Path Aliases (jsconfig.json)

```javascript
"@/*"            // Project root
"@/components/*" // components/
"@/lib/*"        // lib/
"@/app/*"        // app/
```

### Next.js Configuration (next.config.js)

- **Output**: `standalone` for Cloudflare deployment
- **Image Optimization**: Enabled with webp/avif formats
- **Webpack Dev**: File watching optimized (2s poll, 300ms aggregate)
- **CORS Headers**: Configured for embedding and API access
- **X-Frame-Options**: ALLOWALL (for iframe embedding)

### Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- Additional secrets in `.env.production` for deployment

## Component Patterns

### Approval Center Pattern

The approval center demonstrates best practices for modular components:

1. **Multiple View Types**: Card, Table, List, Compact Grid views
2. **View Switcher**: Persistent user preference (localStorage)
3. **Reusable Components**: `EntityCard`, `ApprovalSearchFilter`
4. **Consistent Props**: All views accept same props interface
5. **Responsive Design**: Mobile-first, adapts to all screen sizes

See `APPROVALS_MODULARIZATION_README.md` for detailed documentation.

### UI Components

Uses shadcn/ui pattern - components in `components/ui/`:
- Import from `@/components/ui/[component-name]`
- Built on Radix UI primitives
- Styled with Tailwind CSS using CVA (class-variance-authority)
- Customizable via `components.json` config

### Data Fetching

1. **Server Components** (preferred): Fetch directly in component
2. **Client Components**: Use `lib/data-fetchers.js` utilities
3. **API Routes**: Use when need middleware, validation, or RLS bypass
4. **Supabase Client**:
   - Server: `lib/supabase-server.js`
   - Browser: `lib/supabase-browser.js`
   - Admin: `lib/supabase-admin.js` (service role key)

## Development Guidelines

### Adding New Features

1. **Check RBAC**: Define required permissions in database
2. **Add API Route**: Create in `app/api/[resource]/route.js`
3. **Permission Check**: Use `requirePermission()` in API handler
4. **Create Components**: Follow modular pattern (see approvals/)
5. **RLS Policies**: Add database policies for data access control
6. **Update Routes**: Add to middleware protected routes if needed

### Working with Approvals

The approval system handles:
- Universities, Colleges, Recruiters, Students

Pattern for adding new entity type:
1. Add API endpoints in `app/api/[entity]/`
2. Create view components in `components/approvals/views/`
3. Update `ApprovalSearchFilter.js` with entity-specific filters
4. Add entity icon and display logic to `EntityCard.js`

### Database Operations

**Always use Supabase client, never raw SQL from frontend:**

```javascript
// ✅ Good - using Supabase client
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id)

// ❌ Bad - raw SQL
const result = await db.query('SELECT * FROM table_name WHERE id = $1', [id])
```

**Check permissions before mutations:**

```javascript
// API route pattern
export async function POST(request) {
  const session = await getServerSession()
  await requirePermission(session.user.id, 'resource:create')

  // Proceed with operation
  const { data, error } = await supabase
    .from('table_name')
    .insert(payload)

  return Response.json({ data, error })
}
```

### Styling

- **Utility-first**: Use Tailwind CSS classes
- **Component Variants**: Use CVA for component variations
- **Responsive**: Mobile-first breakpoints (sm, md, lg, xl, 2xl)
- **Dark Mode**: Supported via `next-themes` (theme-aware components)
- **Custom Classes**: Defined in `globals.css`

### Performance

- **Memory Optimization**: Dev server uses `--max-old-space-size=512`
- **File Watching**: Optimized with polling (see next.config.js)
- **Image Optimization**: Configured device sizes and formats
- **Code Splitting**: Automatic with Next.js App Router
- **On-Demand Entries**: Configured for memory efficiency

## Testing & Debugging

### Common Issues

1. **JWT Expired**: Middleware handles gracefully, redirects to login
2. **Permission Denied**: Check user role in `admin_users` table
3. **RLS Blocking Query**: May need to use service role client for admin operations
4. **Build Errors**: Check for client-only code in server components

### Debugging Tools

- Browser DevTools React tab for component inspection
- Supabase Studio for database queries and RLS testing
- Network tab to inspect API calls
- Check middleware logs for auth issues

## Deployment

### Cloudflare Pages

1. **Build Command**: `npm run cf-build`
2. **Output Directory**: `.vercel/output/static` (or `.next`)
3. **Environment Variables**: Set in Cloudflare dashboard
4. **Custom Domains**: Configure in Pages settings

### Pre-deployment Checklist

- [ ] Test all authentication flows
- [ ] Verify RBAC permissions work correctly
- [ ] Check RLS policies are enabled
- [ ] Test on multiple screen sizes
- [ ] Verify all API routes have proper error handling
- [ ] Ensure environment variables are set
- [ ] Test with production Supabase instance

## Important Files Reference

- `ARCHITECTURE.md` - Complete system architecture, database schema, API documentation
- `APPROVALS_MODULARIZATION_README.md` - Approval center implementation details
- `rareminds-admin-doc.md` - Additional admin documentation
- `middleware.js` - Route protection and auth validation
- `lib/rbac.js` - Permission checking utilities

## Security Notes

- JWT tokens validated on every protected route
- Row-level security enforced at database level
- CORS configured for specific origins
- Service role key never exposed to client
- All user inputs validated with Zod schemas
- Audit logs track sensitive operations

## Additional Context

This is an admin dashboard application, not the main user-facing platform. The main platform is a separate React application. Both share the same Supabase database but have different access patterns and UIs.
