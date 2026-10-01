# SP-DASH Deployment Checklist

## Pre-Deployment Checks

### 1. Code Quality
- [ ] All TypeScript/ESLint errors resolved
- [ ] All API routes have `export const runtime = 'edge';`
- [ ] Service bindings properly configured in code
- [ ] Environment variables referenced correctly

### 2. Build Process
```bash
# Clean build
rm -rf .next .open-next

# Build for Cloudflare
npm run build
opennextjs-cloudflare build

# Verify build output
ls -la .open-next/
```

### 3. Local Preview (Optional but Recommended)
```bash
# Preview locally before deploying
npm run preview

# Test key endpoints:
# - http://localhost:8788/organizations/hybrid-plan
# - http://localhost:8788/api/organizations/subscriptions
```

---

## Cloudflare Pages Configuration

### Service Bindings (Settings → Functions → Service Bindings)

| Binding Name | Service | Entrypoint |
|--------------|---------|------------|
| `SSO` | `sso-api` | `SsoWorker` |
| `WORKER_SELF_REFERENCE` | `sp-dash-2` | (default) |

### Environment Variables (Settings → Environment Variables → Production)

**Public Variables**:
```
LTE_SUPABASE_URL=https://jsifqriqlvkpedtoywsk.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://dpooleduinyyzxgrcwko.supabase.co
SKILLPASSPORT_SUPABASE_URL=https://dpooleduinyyzxgrcwko.supabase.co
SSO_WORKER_URL=https://sso-api.dark-mode-d021.workers.dev
```

**Secrets** (use `wrangler secret put`):
```bash
wrangler secret put LTE_SERVICE_ROLE_KEY --env production
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY --env production
wrangler secret put SKILLPASSPORT_SERVICE_ROLE_KEY --env production
```

### KV Namespaces

| Binding | Namespace ID |
|---------|--------------|
| `RATE_LIMIT_KV` | `a162f140e4464515a8d5a27b5ebc6c6b` |

### R2 Buckets

| Binding | Bucket Name |
|---------|-------------|
| `LTE_ASSETS` | `lte` |

### Queues

| Binding | Queue Name |
|---------|------------|
| `MAINTENANCE_EVENTS_QUEUE` | `realtime-events-queue` |

---

## Deployment Commands

### Option 1: Deploy via Wrangler (Recommended)
```bash
cd sp-dash

# Build and deploy in one command
npm run deploy

# Or step by step
opennextjs-cloudflare build
opennextjs-cloudflare deploy
```

### Option 2: Upload Build
```bash
cd sp-dash

# Build and upload
npm run upload
```

### Option 3: GitHub Actions (if configured)
```bash
git push origin main  # Triggers automatic deployment
```

---

## Post-Deployment Verification

### 1. Health Check Endpoints
```bash
# Check if API routes are responding
curl https://admin.skillpassport.rareminds.in/api/organizations/subscriptions

# Should NOT return 308 redirect
# Should return 401 Unauthorized (expected without auth)
```

### 2. Browser Testing
- [ ] Navigate to https://admin.skillpassport.rareminds.in
- [ ] Login with admin credentials
- [ ] Go to Organizations → Activate Hybrid Plan
- [ ] Verify organizations table loads
- [ ] Check browser console for errors (should be clean)

### 3. Check Cloudflare Logs
```bash
# View real-time logs
wrangler tail sp-dash-2

# Filter for errors
wrangler tail sp-dash-2 --format=json | grep -i error
```

### 4. API Route Verification
Test each critical endpoint:
- [ ] `/api/organizations/subscriptions` - List orgs with subscriptions
- [ ] `/api/organizations/feature-keys` - Get feature catalog
- [ ] `/api/users/route` - User management
- [ ] `/api/sales/filters-meta` - Sales filters

---

## Common Issues & Solutions

### Issue: 308 Redirect Errors

**Symptom**: API calls return 308 status  
**Cause**: Missing `export const runtime = 'edge';` in API routes  
**Solution**: Verify all route.js files have runtime declaration

```bash
# Check for missing runtime exports
find app/api -name "route.js" -exec grep -L "export const runtime" {} \;
```

### Issue: "SSO service binding not available"

**Symptom**: 500 errors with SSO binding message  
**Cause**: Service binding not configured in Cloudflare dashboard  
**Solution**: 
1. Go to Cloudflare Pages → sp-dash-2 → Settings → Functions
2. Add Service Binding: SSO → sso-api → SsoWorker
3. Redeploy

### Issue: "SUPABASE_SERVICE_ROLE_KEY is not defined"

**Symptom**: 500 errors on Supabase operations  
**Cause**: Missing environment secrets  
**Solution**:
```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Paste the key when prompted
```

### Issue: Stale Cache

**Symptom**: Old version still serving  
**Solution**:
```bash
# Purge Cloudflare cache
# Option 1: Through dashboard (Caching → Purge Everything)

# Option 2: Via API
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

---

## Rollback Procedure

If deployment fails:

1. **Via Cloudflare Dashboard**:
   - Pages → sp-dash-2 → Deployments
   - Find last working deployment
   - Click "..." → "Rollback to this deployment"

2. **Via Git**:
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Emergency**: Use Wrangler
   ```bash
   # Deploy previous version
   git checkout <previous-commit>
   npm run deploy
   ```

---

## Monitoring

### Key Metrics to Watch
- [ ] API response times (p50, p95, p99)
- [ ] Error rate (should be < 1%)
- [ ] 5xx errors (should be 0)
- [ ] Request rate
- [ ] Edge compute time

### Cloudflare Analytics
1. Go to: Cloudflare Pages → sp-dash-2 → Analytics
2. Monitor:
   - Requests per minute
   - Error rates
   - Function invocations
   - CPU time

### Logs
```bash
# Real-time logs
wrangler tail sp-dash-2

# Filter by status
wrangler tail sp-dash-2 --status error
wrangler tail sp-dash-2 --status ok
```

---

## Version History

| Version | Date | Changes | Deployed By |
|---------|------|---------|-------------|
| v1.2.0 | 2026-09-29 | Added edge runtime to all API routes | - |
| v1.1.0 | 2026-09-25 | Feature keys catalog | - |
| v1.0.0 | 2026-09-01 | Initial production release | - |

---

## Support

**Issues**: Create ticket in project management system  
**Emergency**: Contact DevOps team  
**Documentation**: See `.kiro/summaries/` for detailed fix reports
