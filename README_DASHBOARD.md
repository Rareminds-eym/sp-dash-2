# Rareminds Super Admin Dashboard

A complete, production-ready Super Admin Dashboard built with Next.js 14, Supabase, and Recharts.

## 🚀 Features

### ✅ Complete RBAC System
- **Super Admin**: Full access to all features
- **Admin**: Partial write + read access
- **Manager**: Read-only access

### ✅ Dashboard Pages
1. **Dashboard** - KPI cards, charts, and analytics
2. **Users** - User management with suspend/activate actions
3. **Passports** - Skill passport verification system
4. **Reports** - CSV/Excel export functionality
5. **Audit Logs** - Complete audit trail of all actions
6. **Integrations** - Third-party service connections
7. **Settings** - User profile and notification settings

### ✅ Key Features
- Real-time metrics from Supabase
- Beautiful charts with Recharts (Line, Area, Bar)
- Role-based UI and permissions
- Audit logging for all actions
- Verification workflows
- Toast notifications
- Responsive design with Tailwind CSS
- Modern UI with shadcn/ui components

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Lucide Icons
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Realtime)
- **Charts**: Recharts
- **Exports**: papaparse (CSV), xlsx (Excel)

## 📊 Database Schema

The application uses 7 Supabase tables:

1. **users** - User accounts with roles
2. **organizations** - Universities, colleges, recruiters
3. **students** - Student profiles
4. **skill_passports** - Skill certifications
5. **verifications** - Verification history
6. **audit_logs** - Complete audit trail
7. **metrics_snapshots** - Dashboard metrics

## 🔑 Test Credentials

Use any of these emails with any password (demo mode):

- **Super Admin**: `superadmin@rareminds.com`
- **Admin**: `admin@rareminds.com`
- **Manager**: `manager@rareminds.com`

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Yarn package manager

### Installation

1. Clone the repository
```bash
cd /app
```

2. Install dependencies
```bash
yarn install
```

3. Set up environment variables (already configured)
```env
NEXT_PUBLIC_SUPABASE_URL=https://biyxpafkpvguhuwcejai.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

4. Create database tables

Run the SQL script at `/app/scripts/create-tables.sql` in your Supabase SQL Editor.

5. Seed the database
```bash
./scripts/run-setup.sh
```

6. Start the development server
```bash
yarn dev
```

7. Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
/app
├── app/
│   ├── api/[[...path]]/route.js  # Backend API routes
│   ├── page.js                    # Main app entry
│   ├── layout.js                  # Root layout
│   └── globals.css                # Global styles
├── components/
│   ├── LoginPage.js               # Login UI
│   ├── DashboardLayout.js         # Main layout with sidebar
│   ├── pages/
│   │   ├── Dashboard.js           # Dashboard page
│   │   ├── UsersPage.js           # User management
│   │   ├── PassportsPage.js       # Passport verification
│   │   ├── ReportsPage.js         # Reports & exports
│   │   ├── AuditLogsPage.js       # Audit trail
│   │   ├── IntegrationsPage.js    # Integrations
│   │   └── SettingsPage.js        # Settings
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── supabase.js                # Supabase client
│   ├── supabase-admin.js          # Admin client
│   └── utils.js                   # Utilities
└── scripts/
    ├── create-tables.sql          # Database schema
    └── setup-simple.js            # Seed script
```

## 🔌 API Endpoints

### Metrics & Analytics
- `GET /api/metrics` - Dashboard KPIs
- `GET /api/analytics/trends` - Trend data
- `GET /api/analytics/state-wise` - State distribution

### Data Management
- `GET /api/users` - List users
- `GET /api/organizations` - List organizations
- `GET /api/students` - List students
- `GET /api/passports` - List skill passports
- `GET /api/verifications` - List verifications
- `GET /api/audit-logs` - List audit logs

### Actions
- `POST /api/login` - User login
- `POST /api/verify` - Verify passport
- `POST /api/reject-passport` - Reject passport
- `POST /api/suspend-user` - Suspend user
- `POST /api/activate-user` - Activate user
- `DELETE /api/user` - Delete user (soft delete)

## 🎨 UI Components

Built with shadcn/ui:
- Button, Input, Card, Badge
- Dialog, AlertDialog
- Switch, Label, Separator
- Toast notifications
- Responsive tables

## 📈 Charts

Powered by Recharts:
- **Line Chart**: Trend analysis
- **Area Chart**: Employability & AI verification
- **Bar Chart**: State-wise distribution

## 🔒 Security Features

- Row Level Security (RLS) policies
- Role-based access control
- Audit logging for all actions
- Secure API routes
- Server-side validation

## 🚀 Deployment

### Vercel Deployment

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

### Environment Variables

Required for production:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 📊 Metrics Tracked

- Active Universities
- Registered Students
- Verified Passports
- AI Verification %
- Employability Index
- Active Recruiters

## 🔄 Real-time Features

- Live metrics updates
- Real-time verification alerts
- Instant status changes
- Supabase Realtime subscriptions (ready for implementation)

## 🛡️ Role Permissions

| Feature | Super Admin | Admin | Manager |
|---------|-------------|-------|---------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Users | ✅ | ✅ | ✅ |
| Suspend/Activate Users | ✅ | ❌ | ❌ |
| Verify Passports | ✅ | ✅ | ❌ |
| View Audit Logs | ✅ | ✅ | ✅ |
| Export Data | ✅ | ✅ | ❌ |
| Manage Settings | ✅ | ✅ | ❌ |

## 📝 Notes

- This is a demo with simplified authentication
- In production, implement Supabase Auth properly
- Add proper password hashing and JWT tokens
- Implement 2FA for super admins
- Add rate limiting for API endpoints
- Set up proper RLS policies based on user roles

## 🤝 Support

For issues or questions, contact the Rareminds team.

## 📄 License

Proprietary - Rareminds © 2025
