# Login Troubleshooting Guide

## Issue: "Invalid email or password" or 405 Method Not Allowed

### Root Cause
The SSO Worker's CORS configuration was missing the `ALLOWED_ORIGINS` environment variable.

### Solution Steps

#### 1. **Stop SSO Worker**
- Go to the terminal where SSO Worker is running
- Press `Ctrl+C` to stop it

#### 2. **Verify Environment Variables**
Check `sso-worker/.dev.vars` contains:
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8788,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:8788
```

#### 3. **Restart SSO Worker**
```bash
cd sso-worker
npm run dev
```

#### 4. **Test Login**
```bash
cd sp-dash-2
node test-login.js
```

Expected output:
```
✅ Login successful!
User ID: [user-id]
Email: admin@rareminds.in
```

#### 5. **Test Dashboard Login**
- Go to http://localhost:3000/login
- Use credentials:
  - Email: `admin@rareminds.in`
  - Password: `Admin@123` (or your actual password)

---

## Default Admin Credentials

If you need to reset or create the admin user:

```bash
cd sso-worker
node scripts/create-super-admin.mjs
```

This creates:
- **Email**: `admin@rareminds.in`
- **Password**: `Admin@123`
- **Roles**: `['super_admin']`

---

## Verification Checklist

### ✅ SSO Worker Status
- [ ] SSO Worker running on http://localhost:8788
- [ ] Health check: http://localhost:8788/health returns 200
- [ ] CORS configured with `ALLOWED_ORIGINS`

### ✅ Database Status
- [ ] Supabase running on http://127.0.0.1:54331
- [ ] Admin user exists in `users` table
- [ ] Admin user has correct password hash

### ✅ Dashboard Status
- [ ] Next.js running on http://localhost:3000
- [ ] Login page accessible: http://localhost:3000/login
- [ ] SSO_WORKER_URL configured in `.env.local`

---

## Common Issues

### Issue: "User not found"
**Solution**: Create admin user
```bash
cd sso-worker
node scripts/create-super-admin.mjs
```

### Issue: "Wrong password"
**Solution**: Reset password or use correct password
- Default password: `Admin@123`
- Or reset via forgot password flow

### Issue: "Access denied - not authorized"
**Solution**: Check user roles
```sql
-- Check user roles in Supabase
SELECT email, roles FROM users WHERE email = 'admin@rareminds.in';
```

### Issue: "SSO Worker not responding"
**Solution**: Check SSO Worker is running
```bash
curl http://localhost:8788/health
```

### Issue: "CORS error"
**Solution**: Verify `ALLOWED_ORIGINS` in `.dev.vars`
```bash
# Should include your dashboard URL
ALLOWED_ORIGINS=http://localhost:3000,...
```

---

## Debug Commands

### Test SSO Worker Login
```bash
cd sp-dash-2
node test-login.js
```

### Check SSO Worker Health
```bash
curl http://localhost:8788/health
```

### Check Database Connection
```bash
cd sso-worker
npx supabase status
```

### View SSO Worker Logs
Check the terminal where `npm run dev` is running for error messages.

---

## Production Deployment

For production, ensure:

1. **SSO Worker deployed** with correct `ALLOWED_ORIGINS`
2. **Dashboard deployed** with correct `SSO_WORKER_URL`
3. **Database credentials** updated in production environment
4. **Admin user created** in production database

---

## Contact

If issues persist:
1. Check SSO Worker terminal for error logs
2. Check browser developer console for network errors
3. Verify all environment variables are set correctly
4. Ensure both SSO Worker and Dashboard are running