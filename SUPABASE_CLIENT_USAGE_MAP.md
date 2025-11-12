# Supabase Client Usage Map

Complete mapping of where each Supabase client is used across the application.

---

## Summary Statistics

| Client Type | Total Files | Purpose |
|-------------|-------------|---------|
| `supabase-rls` | 25 files | Row Level Security enforcement + user context |
| `supabase-admin` | 39 files | Admin operations (bypasses RLS) |
| Both (dual usage) | 13 files | RLS for auth + Admin for operations |

---

## 1. `supabase-rls` Usage (25 files)

### Protected Pages (6 files)
These use RLS to enforce role-based access at the page level:

```
✅ /app/app/(dashboard)/dashboard/page.js
✅ /app/app/(dashboard)/users/page.js
✅ /app/app/(dashboard)/passports/page.js
✅ /app/app/(dashboard)/recruiters/page.js
✅ /app/app/(dashboard)/settings/page.js
✅ /app/app/(dashboard)/approvals/page.js
```

**Why RLS?** Each admin user sees only the data they're authorized to view based on their role.

---

### User-Context API Routes (19 files)
These need to know WHO is performing the action for audit trails:

#### Approval/Rejection Operations (8 files)
```
📝 /app/api/colleges/approve/route.js
📝 /app/api/colleges/reject/route.js
📝 /app/api/universities/approve/route.js
📝 /app/api/universities/reject/route.js
📝 /app/api/recruiters/approve/route.js
📝 /app/api/recruiters/reject/route.js
📝 /app/api/students/approve/route.js
📝 /app/api/students/reject/route.js
```

#### Activation/Suspension Operations (4 files)
```
📝 /app/api/recruiters/activate/route.js
📝 /app/api/recruiters/suspend/route.js
📝 /app/api/users/activate/route.js
📝 /app/api/users/suspend/route.js
```

#### Verification & Passport Operations (2 files)
```
📝 /app/api/passports/verify/route.js
📝 /app/api/passports/reject/route.js
```

#### Bulk & User Operations (5 files)
```
📝 /app/api/recruiters/bulk-action/route.js
📝 /app/api/users/[id]/route.js
📝 /app/api/users/profile/route.js
📝 /app/api/metrics/update/route.js
📝 /app/api/analytics/university-reports/export/route.js
```

---

## 2. `supabase-admin` Usage (39 files)

### Analytics APIs (10 files)
These need to access all data for comprehensive reports:

```
📊 /app/api/analytics/ai-insights/route.js
📊 /app/api/analytics/ai-insights/export/route.js
📊 /app/api/analytics/placement-conversion/route.js
📊 /app/api/analytics/placement-conversion/export/route.js
📊 /app/api/analytics/recruiter-metrics/route.js
📊 /app/api/analytics/recruiter-metrics/export/route.js
📊 /app/api/analytics/state-heatmap/route.js
📊 /app/api/analytics/state-heatmap/export/route.js
📊 /app/api/analytics/state-wise/route.js
📊 /app/api/analytics/trends/route.js
```

---

### Audit Logs (3 files)
Full access to audit trail for compliance:

```
📋 /app/api/audit-logs/actions/route.js
📋 /app/api/audit-logs/export/route.js
📋 /app/api/audit-logs/users/route.js
```

---

### Data Management APIs (26 files)

#### Recruiters (9 files)
```
👔 /app/api/recruiters/route.js
👔 /app/api/recruiters/[id]/route.js
👔 /app/api/recruiters/states/route.js
👔 /app/api/recruiters/export/route.js
👔 /app/api/recruiters/approve/route.js ⚡ (also uses RLS)
👔 /app/api/recruiters/reject/route.js ⚡ (also uses RLS)
👔 /app/api/recruiters/activate/route.js ⚡ (also uses RLS)
👔 /app/api/recruiters/suspend/route.js ⚡ (also uses RLS)
👔 /app/api/recruiters/bulk-action/route.js ⚡ (also uses RLS)
```

#### Universities (5 files)
```
🎓 /app/api/universities/route.js
🎓 /app/api/universities/[id]/route.js
🎓 /app/api/universities/[id]/colleges/route.js
🎓 /app/api/universities/approve/route.js ⚡ (also uses RLS)
🎓 /app/api/universities/reject/route.js ⚡ (also uses RLS)
```

#### Colleges (3 files)
```
🏫 /app/api/colleges/route.js
🏫 /app/api/colleges/approve/route.js ⚡ (also uses RLS)
🏫 /app/api/colleges/reject/route.js ⚡ (also uses RLS)
```

#### Students (3 files)
```
👨‍🎓 /app/api/students/route.js
👨‍🎓 /app/api/students/approve/route.js ⚡ (also uses RLS)
👨‍🎓 /app/api/students/reject/route.js ⚡ (also uses RLS)
```

#### Passports (3 files)
```
🎫 /app/api/passports/universities/route.js
🎫 /app/api/passports/export/route.js
🎫 /app/api/passports/reject/route.js ⚡ (also uses RLS)
```

#### Users & Organizations (3 files)
```
👤 /app/api/users/organizations/route.js
👤 /app/api/users/profile/route.js ⚡ (also uses RLS)
👤 /app/api/organizations/route.js
```

---

## 3. Files Using BOTH Clients (13 files)

These files use **dual client approach**:
- `supabase-rls` for authentication and getting user context
- `supabase-admin` for performing the actual database operations

### Pattern Used:
```javascript
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createRLSClient, getUserContext } from '@/lib/supabase-rls'

export async function POST(request) {
  // Step 1: Authenticate with RLS client
  const { supabase: rlsClient, user, error: authError } = await createRLSClient(request)
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Step 2: Get user context (who is performing this action)
  const userContext = await getUserContext(rlsClient, user)
  
  // Step 3: Perform operation with admin client (bypass RLS)
  const { data, error } = await supabaseAdmin
    .from('table_name')
    .update({ status: 'approved', approved_by: userContext.id })
    .eq('id', itemId)
  
  return NextResponse.json({ success: true })
}
```

### Files with Dual Client Usage:

**Approval Operations (8 files):**
```
⚡ /app/api/colleges/approve/route.js
⚡ /app/api/colleges/reject/route.js
⚡ /app/api/universities/approve/route.js
⚡ /app/api/universities/reject/route.js
⚡ /app/api/recruiters/approve/route.js
⚡ /app/api/recruiters/reject/route.js
⚡ /app/api/students/approve/route.js
⚡ /app/api/students/reject/route.js
```

**State Change Operations (4 files):**
```
⚡ /app/api/recruiters/activate/route.js
⚡ /app/api/recruiters/suspend/route.js
⚡ /app/api/recruiters/bulk-action/route.js
⚡ /app/api/passports/reject/route.js
```

**User Profile (1 file):**
```
⚡ /app/api/users/profile/route.js
```

---

## Why Different Clients?

### `supabase-rls` (RLS Enforced)
**Use When:**
- Need to know WHO is performing an action
- Want database to enforce role-based access
- Building audit trails
- User should only see their authorized data

**Security:**
- ✅ Role-based filtering
- ✅ User context tracked
- ✅ Can't access unauthorized data
- ✅ Database enforces rules

---

### `supabase-admin` (RLS Bypassed)
**Use When:**
- Need full access to all data
- Building analytics/reports
- System-level operations
- Export functionality
- Reading data for admin dashboards

**Security:**
- ⚠️ Full database access
- ⚠️ Bypasses all RLS policies
- ⚠️ Use with caution
- ✅ Required for admin operations

---

### Dual Usage (Both Clients)
**Use When:**
- Need user authentication (RLS)
- But also need to perform admin operation (Admin)
- Example: Approve/reject workflows

**Pattern:**
1. Authenticate with RLS → Know WHO
2. Get user context → Record actor
3. Perform operation with Admin → Execute action
4. Best of both worlds

---

## Security Considerations

### ✅ Good Practices (Currently Implemented):

1. **Protected Pages use RLS**
   - Each admin sees only their authorized data
   - Database enforces access control

2. **Action APIs use RLS for auth**
   - Track who performed each action
   - Maintain audit trail

3. **Read-only APIs use Admin**
   - Analytics need full data access
   - Export features need complete datasets

4. **Approval workflows use both**
   - Authenticate user (RLS)
   - Perform admin action (Admin)

---

### ⚠️ Important Reminders:

1. **RLS Policies Must Be Configured**
   - Database policies need to be set up in Supabase
   - Test with different role accounts
   - Verify access restrictions work

2. **Admin Client = Full Access**
   - Only use when absolutely necessary
   - Never expose directly to frontend
   - Always validate user permissions first

3. **Audit Trail**
   - RLS client helps track user actions
   - Log important operations
   - Maintain compliance records

---

## Testing Checklist

### For RLS-Protected Pages:
- [ ] Super admin can access all pages
- [ ] Regional admin only sees their region
- [ ] Organization admin only sees their org
- [ ] Unauthorized users redirected to login

### For API Routes:
- [ ] RLS routes authenticate users correctly
- [ ] Admin routes return complete data sets
- [ ] Dual-client routes track user actions
- [ ] Error handling works properly

### For Role-Based Access:
- [ ] Database RLS policies are configured
- [ ] Each role has appropriate permissions
- [ ] Data filtering works as expected
- [ ] No unauthorized data leaks

---

## Files Summary

```
Total Supabase Client Usage: 64 files

Pages:                  6 files  (RLS only)
APIs (RLS only):       12 files  (User context)
APIs (Admin only):     26 files  (Full access)
APIs (Both):           13 files  (Auth + Admin)
Services:               2 files  (Admin only)
Middleware:             1 file   (Auth helper)

Legend:
✅ = Using supabase-rls
📊 = Using supabase-admin
⚡ = Using BOTH clients
```

---

## Conclusion

The application uses a **three-tier security model**:

1. **RLS Pages** - Role-based access at UI level
2. **RLS APIs** - User-attributed actions with audit
3. **Admin APIs** - Full data access for reports

This provides **defense in depth** with appropriate security at each layer.
