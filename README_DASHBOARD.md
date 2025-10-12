# Rareminds Super Admin Dashboard

A comprehensive dashboard for managing universities, students, skill passports, and recruiter engagement.

## 🚀 Features

- **Dashboard Analytics** - Real-time metrics and KPIs
- **User Management** - View and manage all platform users
- **Passport Verification** - Review and verify student skill passports
- **Recruiter Management** - Track recruiter engagement and approvals
- **Audit Trail** - Complete log of all administrative actions
- **Reports & Analytics** - Detailed insights and trends

## 🛠️ Tech Stack

- Next.js 14 (App Router)
- React Server Components
- Supabase (Database & Auth)
- Tailwind CSS
- Shadcn UI Components
- Recharts for data visualization

## 📦 Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Supabase project
4. Run database setup: `node scripts/setup-database.js`
5. Create `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 📊 Metrics Tracked

- Active Universities
- Registered Students
- Verified Passports
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
