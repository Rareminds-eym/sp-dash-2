# Auth Error Consolidation Plan

**Created**: 2026-06-30
**Context**: Production review of `app/api/auth/sso-login/route.js` fix revealed codebase-wide auth error handling gaps.

---

## Problem

The `sso-login/route.js` login bug was fixed (SSO Worker RPC `status` forwarding + `respondError` helper), but the deep audit identified **15 systemic issues** across the auth layer:

| # | Issue | Severity | Scope |
|---|-------|----------|-------|
| 1 | `{ success: false, error }` duplicated inline in 5/7 auth routes | M | Phase 1 |
| 2 | 3 different error response shapes in use (`{ success, error }`, `{ authenticated, user, error }`, `{ error }`) | M | Phase 2 |
| 3 | No ESLint config (`globals` in devDeps but no `.eslintrc*`) | M | Phase 3 |
| 4 | Zero test coverage on any auth route | H | Phase 4 |
| 5 | No `Content-Type` validation on `sso-login/route.js` | L | Phase 5 |
| 6 | No request body size limit on `sso-login/route.js` (SSO Worker has 10 KB downstream) | L | Phase 5 |
| 7 | `forgot-password/route.js` returns `{ error }` without `success: false` on error paths (4 occurrences) | L | Phases 1-2 |
| 8 | `forgot-password/route.js` calls `supabaseAdmin.auth.resetPasswordForEmail()` — bypasses SSO Worker + auth-core mandate | M | Phase 6 |
| 9 | `login/route.js` uses `supabase.auth.signInWithPassword()` directly — old pre-SSO flow still active | M | Phase 6 |
| 10 | `sso-login/route.js` missing logging on 3 error paths (malformed JSON, invalid token payload, no admin role) | L | Phase 5 |
| 11 | `refresh/route.js` catch returns generic 500 instead of extracting `refreshSession()` throw messages | H | Phase 7 |
| 12 | `refresh/route.js` reads `refreshData.status` (line 44) but `refreshSession()` never sets it — dead code | L | Phase 7 |
| 13 | `rpc-types.ts` SSO Worker interface is stale — 4 methods missing, 2 return types incomplete | M | Phase 8 |
| 14 | **Method name mismatches**: `sso-service-client.js` calls `binding.refresh()` and `binding.logout()` but SSO Worker has `refreshSession()`/`logoutSession()` — both also pass object args instead of 3 positional params | **H** | Phase 7 |
| 15 | **18 additional non-existent RPC methods** in `sso-service-client.js` — all throw "Method not found" at the binding layer | **H** | Phase 9 |

---

## Error Response Shapes — Current State

| Route | Method | Error Shape | Notes |
|-------|--------|-------------|-------|
| `app/api/auth/sso-login/route.js` | POST | `{ success: false, error }` | ✅ Has `respondError` helper |
| `app/api/auth/login/route.js` | POST | `{ success: false, error }` | ❌ Inline — 7 occurrences |
| `app/api/auth/refresh/route.js` | POST | `{ success: false, error }` | ❌ Inline — 6 occurrences |
| `app/api/auth/sso-session/route.js` | GET | `{ success: false, error }` | ❌ Inline — 3 occurrences |
| `app/api/auth/logout/route.js` | POST | `{ success: false, error }` | ❌ Inline — 1 occurrence |
| `app/api/auth/session/route.js` | GET | `{ authenticated: false, user: null, error }` | ❌ Different shape (by design — returns session state) |
| `app/api/auth/forgot-password/route.js` | POST | `{ error }` (no `success` field) | ❌ Different shape (partly security-driven) |

---

## Phase 1: Shared Error Utility

**Files**: `lib/response-utils.js` (create) + 5 route files (update)
**Est. time**: ~15 min
**Risk**: Low

### Steps

1. **Create** `lib/response-utils.js`:
   ```js
   import { NextResponse } from 'next/server'

   export function respondError(status, error) {
     return NextResponse.json({ success: false, error }, { status })
   }

   export function respondJson(data, status = 200) {
     return NextResponse.json({ success: true, ...data }, { status })
   }
   ```

2. **Update** `app/api/auth/sso-login/route.js`:
   - Replace local `function respondError` with `import { respondError } from '@/lib/response-utils'`

3. **Update** `app/api/auth/login/route.js`:
   - Lines 12-15, 27-30, 111-116, 126-131, 138-148: Replace `NextResponse.json({ success: false, error }, { status })` with `respondError(status, error)`
   - The success response (line 161-173) can optionally use `respondJson`

4. **Update** `app/api/auth/refresh/route.js`:
   - Lines 20-23, 43-46, 53-56, 64-67, 74-78, 138-142: Replace with `respondError`

5. **Update** `app/api/auth/sso-session/route.js`:
   - Lines 20-23, 36-39, 48-54: Replace with `respondError`

6. **Update** `app/api/auth/logout/route.js`:
   - Lines 79-82: Replace with `respondError`

### Verification
- `node --check` on all modified files
- Smoke test: login, refresh, session check, logout flows

---

## Phase 2: Standardize Error Shapes

**Files**: `app/api/auth/session/route.js`, `app/api/auth/forgot-password/route.js`, frontend consumers
**Est. time**: ~30 min + frontend verification
**Risk**: Medium

### Steps

1. **Frontend audit** — Find all consumers of `session` and `forgot-password` endpoints:
   - Search for `/api/auth/session` and `/api/auth/forgot-password` in `components/` and `lib/`
   - Check what fields they read from the response
   - **Note**: `LoginPageRedesigned.js:224` reads `data.requiresVerification` from login response — verify this field is preserved

2. **`forgot-password/route.js`** — Add `success: false` to error responses:
   - Line 13: `{ error: 'Email is required' }` → `{ success: false, error: 'Email is required' }`
   - Line 22: `{ error: 'Invalid email format' }` → `{ success: false, error: 'Invalid email format' }`
   - Line 73: `{ error: 'Too many...' }` → `{ success: false, error: 'Too many...' }`
   - Line 99: `{ error: 'An error occurred...' }` → `{ success: false, error: 'An error occurred...' }`
   - Keep `{ success: true, message }` responses as-is (security-driven anti-enumeration)

3. **`session/route.js`** — Assess migration to `{ success: false, error }`:
   - Current shape `{ authenticated: false, user: null, error }` is used by GET endpoint
   - Check frontend: does it read `data.authenticated` or `data.success`?
   - If frontend reads `data.authenticated`, keep current shape — it's semantically correct for a session endpoint
   - If frontend only reads `data.error`, can add `success: false` alongside existing fields

### Verification
- Manual test of forgot-password flow end-to-end
- Manual test of session check (login → refresh page → verify session persists)

---

## Phase 3: ESLint Config

**Files**: `.eslintrc.cjs` (create), `package.json` (update)
**Est. time**: ~30 min
**Risk**: Low

### Steps

1. **Create** `.eslintrc.cjs`:
   ```js
   module.exports = {
     root: true,
     env: { browser: true, node: true, es2022: true },
     extends: ['eslint:recommended'],
     parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
     rules: {
       'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
       'no-console': 'off', // Allow console.log — edge runtime logging
     },
   }
   ```

2. **Update** `package.json`:
   ```json
   "scripts": {
     "lint": "eslint .",
     "lint:fix": "eslint . --fix"
   }
   ```

3. **Run** `npm run lint:fix` — auto-fix what it can
4. Manually review remaining warnings

### Verification
- `npm run lint` exits with 0
- No style-only changes introduced (focus on correctness rules)

---

## Phase 4: Auth Route Tests

**Files**: `__tests__/api/auth/sso-login.test.js` (create), `package.json` (update)
**Est. time**: ~2-3 hours
**Risk**: Low

### Steps

1. **Check existing test patterns** — look at `auth-core` or `auth-client` test files for patterns (mocking, assertions, etc.)

2. **Choose framework** — Vitest recommended (works with Edge runtime, already in dependency tree). Jest is an alternative.

3. **Write tests** for `app/api/auth/sso-login/route.js`:
   ```js
   describe('POST /api/auth/sso-login', () => {
     it('returns 400 when email is missing', async () => { ... })
     it('returns 400 when password is missing', async () => { ... })
     it('returns 400 when JSON body is malformed', async () => { ... })
     it('returns 401 with error message from SSO Worker business-logic error', async () => { ... })
     it('falls back to 401 when SSO Worker RPC throws', async () => { ... })
     it('returns 500 when JWT verification fails', async () => { ... })
     it('returns 200 with cookies on successful login', async () => { ... })
   })
   ```

4. **Mock `sso-service-client.js`** — mock `createSSOServiceClient` to return a controlled binding

5. **Add test script** to `package.json`

### Key Behaviors to Test

| Input | Expected Status | Expected Error |
|-------|----------------|----------------|
| `{ }` (no email/password) | 400 | `Email and password are required` |
| `{invalid json}` | 400 | `Invalid JSON in request body` |
| RPC returns `{ success: false, error: "Invalid credentials", status: 401 }` | 401 | `Invalid credentials` |
| RPC throws (binding missing) | 401 | From catch block string matching |
| JWT token is invalid | 500 | `Login failed - invalid token received` |
| Valid credentials, valid JWT, admin role | 200 | `{ success: true, user, accessToken }` |

---

## Phase 5: Hardening + Missing Logging

**Files**: `app/api/auth/sso-login/route.js`
**Est. time**: ~15 min
**Risk**: Low

### Steps

1. **Add Content-Type validation** after JSON parse:
   ```js
   const contentType = request.headers.get('content-type') || ''
   if (!contentType.includes('application/json')) {
     return respondError(415, 'Content-Type must be application/json')
   }
   ```

2. **Add body size limit** before JSON parse:
   ```js
   const contentLength = parseInt(request.headers.get('content-length') || '0', 10)
   if (contentLength > 10240) { // 10 KB
     return respondError(413, 'Request body too large')
   }
   ```
   **Note**: The `content-length` header may not be present in all environments (e.g., chunked transfer encoding). For robust enforcement, consider streaming or using `request.clone().arrayBuffer()` to check actual size.

3. **Apply the same hardening** to `refresh/route.js` and `login/route.js` if applicable.

4. **Add logging on 3 missing error paths**:

   | Path | Current behavior | Fix |
   |------|-----------------|-----|
   | Malformed JSON catch (line ~173-175) | Returns 400 silently | Add `console.error` with descriptive message |
   | Invalid JWT token (line ~84) | Returns 500 silently | Add `console.error` — this is an unexpected state |
   | No admin role (line ~92-101) | Returns 403 silently | Add `console.warn` — this is a **security event** (non-admin hit login) |

### Verification
- Send request with `Content-Type: text/plain` → 415
- Send request with body > 10 KB → 413
- Normal login flow still works

---

## Phase 6: SSO Migration Gaps

**Files**: `app/api/auth/forgot-password/route.js`, `app/api/auth/login/route.js`, possibly SSO Worker
**Est. time**: TBD (larger effort — needs separate scoping)
**Risk**: Medium-High

### Issues

| Route | Current Behavior | Target Behavior |
|-------|----------------|----------------|
| `forgot-password` | Calls `supabaseAdmin.auth.resetPasswordForEmail()` directly | Call SSO Worker RPC `forgotPassword()` (already exists at `sso-worker/src/index.ts:1295`) |
| `login` (old) | Calls `supabase.auth.signInWithPassword()` + queries `admin_users` table | Deprecate in favor of `POST /api/auth/sso-login` |

### Scope Considerations

- **`forgot-password` migration**: The SSO Worker already has a `forgotPassword()` RPC method. The route needs to switch from `supabaseAdmin.auth.resetPasswordForEmail()` to `ssoClient.forgotPassword({ email, redirect_url })`. However, the current route returns `{ success: true, message }` even when the user doesn't exist (anti-enumeration). The SSO Worker's `forgotPassword()` behavior needs to be verified to match this security requirement.

- **`login` (old) deprecation**: The old login route checks `admin_users` table and `recruiter` role blocking. The SSO Worker handles auth but the admin role check happens in `sso-login/route.js`. Verify the old route has no additional security checks missing from the SSO flow.

### Recommended Approach
1. Create a separate plan for SSO migration gap analysis
2. Map all features of the old `login` route that aren't covered by `sso-login`
3. Migrate `forgot-password` to SSO Worker RPC
4. Deprecate old `login` route with a sunset header

---

## Phase 7: Fix `refresh` + `logout` Method Name/Signature Mismatches

**Files**: `sp-dash/lib/sso-service-client.js`, `app/api/auth/refresh/route.js`, `app/api/auth/logout/route.js`
**Est. time**: ~45 min
**Risk**: Medium

### Critical Finding: Method Name + Signature Mismatches

Two methods in `sso-service-client.js` have wrong names AND wrong argument shapes:

| Method | Client line | Current call | Should call | SSO Worker signature |
|--------|-------------|-------------|-------------|---------------------|
| `refresh` | 341 | `this.binding.refresh({ refresh_token, ip, ua })` | `this.binding.refreshSession(refreshToken, ip, ua)` | `refreshSession(refreshToken: string, ip?: string, ua?: string)` — 3 positional params |
| `logout` | 353 | `this.binding.logout({ refresh_token, ip, ua })` | `this.binding.logoutSession(refreshToken, ip, ua)` | `logoutSession(refreshToken: string, ip?: string, ua?: string)` — 3 positional params |

### Dead Code

`refresh/route.js` lines 37–46 check `refreshData.error` and read `refreshData.status`, but `refreshSession()` **never returns error objects** — it either returns `{ access_token, refresh_token }` on success or **throws** on failure. The entire `if (refreshData.error)` block is unreachable.

### All `refreshSession()` Error Throws (SSO Worker `src/index.ts:1198-1238`)

| # | Throw Condition | Error Message | Expected HTTP Status |
|---|----------------|---------------|---------------------|
| 1 | No refresh token | `"No refresh token provided"` | 400 |
| 2 | Token reuse | `"Refresh token reuse detected. All sessions revoked."` | 401 |
| 3 | Account blocked | `"Account is blocked"` | 403 |
| 4 | Session expired | `"Session expired"` | 401 |
| 5 | Session expired (alt) | `"Session expired"` | 401 |
| 6 | Invalid token | `"Invalid refresh token"` | 401 |

### Steps

1. **Fix `sso-service-client.js` `refresh()`** (line 341):
   ```js
   // Current:
   async refresh(params) {
     return await this.binding.refresh(params)
   }
   // Fixed:
   async refresh(params) {
     return await this.binding.refreshSession(
       params.refresh_token,
       params.ip,
       params.ua,
     )
   }
   ```

2. **Fix `sso-service-client.js` `logout()`** (line 353):
   ```js
   // Current:
   async logout(params) {
     return await this.binding.logout(params)
   }
   // Fixed:
   async logout(params) {
     return await this.binding.logoutSession(
       params.refresh_token,
       params.ip,
       params.ua,
     )
   }
   ```

3. **Fix `updateMembershipStatus()`** arg shape (line 224):
   ```js
   // Current:
   async updateMembershipStatus(membershipId, status) {
     return await this.binding.updateMembershipStatus(membershipId, status)
   }
   // Fixed (matches SSO Worker's 1-object signature):
   async updateMembershipStatus(data) {
     return await this.binding.updateMembershipStatus(data)
   }
   ```

4. **Fix `refresh/route.js` catch block** — extract error message + status mapping:
   ```js
   // Current (line 136-142):
   } catch (error) {
     console.error('[Token Refresh] Error:', error.message || error)
     return NextResponse.json(
       { success: false, error: 'An error occurred during token refresh' },
       { status: 500 }
     )
   }

   // Fixed:
   } catch (error) {
     const message = error.message || String(error)
     const status =
       message.includes('session theft') || message.includes('reuse') ? 401 :
       message.includes('blocked') ? 403 :
       message.includes('expired') ? 401 :
       message.includes('No refresh token') ? 400 :
       message.includes('Invalid') ? 401 :
       500
     console.error('[Token Refresh] Error:', message)
     return respondError(status, message)
   }
   ```

5. **Remove dead code** in `refresh/route.js` lines 37–46 (the `if (refreshData.error)` block). After step 1, `refreshSession()` still **throws** on errors — the returned value is always the success shape. The `.error`/`.status` checks are unreachable.

6. **Fix `logout/route.js` catch block** to extract error messages:
   ```js
   // Current (line 33-35):
   } catch (error) {
     console.error('[Logout] Error:', error.message || error)
   }
   // Fixed:
   } catch (error) {
     console.error('[Logout] Error:', error.message || String(error))
   }
   ```

### Verification
- Manual test: Expired session → 401 with "Session expired" (not generic 500)
- Manual test: Blocked account → 403 with "Account is blocked"
- Manual test: Valid refresh → 200 with tokens
- Manual test: Logout with valid session → 200 with `{ success: true }`
- `node --check` on all modified files

---

## Phase 8: Update `rpc-types.ts` SSO Worker Interface

**Files**: `skillpassport/functions/lib/rpc-types.ts`
**Est. time**: ~15 min + verification
**Risk**: Low

### Issues Found

| Type Definition | Line | Problem |
|----------------|------|---------|
| `login()` return type | 24 | `Promise<any>` — too loose. My `status` addition is type-safe, but others won't get type-safety |
| `refreshSession()` return type | 25 | Claims `Promise<{ access_token, refresh_token }>` but actually **throws** on all errors (no documented error path) |
| `forgotPassword()` return type | 27 | Says `Promise<{ message? }>` but returns `{ success: false, error }` on errors |
| `resetPassword()` return type | 28 | Says `Promise<{ reset? }>` but returns `{ success: false, error }` on errors |
| Missing method: `createMember` | — | Exists on SSO Worker at line 497 but not in interface |
| Missing method: `signup` | — | Exists on SSO Worker at line 1088 but not in interface |
| Missing method: `requestVerification` | — | Exists on SSO Worker at line 1112 but not in interface |
| Missing method: `verifyEmail` | — | Exists on SSO Worker at line 1136 but not in interface |

### Steps

1. **Read current SSO Worker** (`sso-worker/src/index.ts`) to get actual method signatures
2. **Read current `rpc-types.ts`** to see full current state
3. **Update interface** to match real behavior:

   ```typescript
   interface SsoWorkerRpc {
     login(params: { email: string; password: string; ip?: string; ua?: string }): Promise<{
       success: false; error: string; status: number
     } | {
       success: true; user: UserData; access_token: string; refresh_token: string
     }>
   }
   ```

4. **Add missing methods**: `signup`, `verifyEmail`, `requestVerification`, `createMember`
5. **Fix incomplete return types**: `forgotPassword` and `resetPassword` should include `{ success: false, error: string }` in their return union
6. **Tag the interface** with a `@lastVerified` comment to track staleness

### Verification
- `node --check` on `rpc-types.ts`
- Check that existing callers compile without new errors
- If any caller relied on the wrong type (e.g., assumed `refreshSession()` always returns `{ access_token }`), flag for review

---

## Phase 9: Rewrite `sso-service-client.js`

**Files**: `sp-dash/lib/sso-service-client.js`, `sp-dash/lib/middleware/sso-auth.js`, `app/api/auth/sso-session/route.js`
**Est. time**: ~1-2 hours
**Risk**: Medium

### Background

`sp-dash/lib/sso-service-client.js` has 26 methods that call `this.binding.*` RPC methods on the SSO Worker. Only **5 work correctly**, 3 are fixed in Phase 7, and **18 call methods that don't exist** on the `SsoWorker` class at all.

The binding `env.SSO` is hardcoded to route to `sso-api` → `SsoWorker` (confirmed via `sp-dash/wrangler.toml:8-11`). There is **no other Worker** in the codebase that implements these missing methods.

### Methods to KEEP *(verified to exist on SsoWorker)*

| Client method | SsoWorker method | Already works? |
|---------------|-----------------|----------------|
| `login(params)` | `login(params)` | ✅ Yes |
| `getUserMemberships(userId)` | `getUserMemberships(userId)` | ✅ Yes |
| `getSalesSubscriptions(str)` | `getSalesSubscriptions(str)` | ✅ Yes |
| `getJWKS()` | `getJWKS()` | ✅ Yes |
| `getSalesFilterMeta()` | `getSalesFilterMeta()` | ✅ Yes |
| `refresh(params)` | `refreshSession(refreshToken, ip?, ua?)` | ❌ Fixed in Phase 7 |
| `logout(params)` | `logoutSession(refreshToken, ip?, ua?)` | ❌ Fixed in Phase 7 |
| `updateMembershipStatus(a, b)` | `updateMembershipStatus({ membership_id, status })` | ❌ Fixed in Phase 7 |

### Methods to REMOVE *(no RPC equivalent anywhere in codebase)*

These 18 methods call `this.binding.X()` but `X()` doesn't exist on `SsoWorker` or any other Worker:

`verifyToken`, `getUser`, `issueAccessToken`, `listUsers`, `setUserBlockStatus`, `adminVerifyEmail`, `getOrganization`, `listOrganizations`, `getOrganizationMembers`, `updateOrganization`, `getOrganizationStats`, `updateMembershipRoles`, `getUserSessions`, `revokeSession`, `revokeAllUserSessions`, `getOrganizationInvites`, `adminCancelInvite`, `getUserActivity`

### Steps

1. **Read current `sso-service-client.js`** to verify exact method list and signatures
2. **Remove all 18 non-existent methods** from the `SSOServiceClient` class
3. **Fix the 3 signature mismatches** from Phase 7 (already done as part of that phase)
4. **Update `middleware/sso-auth.js`** — replace `ssoClient.verifyToken(accessToken)` with `ssoClient.getMe(accessToken)`. Verify that `getMe()` returns the user data the middleware needs:
   ```js
   // Current (line 106):
   const userData = await ssoClient.verifyToken(accessToken)
   // Fixed:
   const userData = await ssoClient.getMe(accessToken)
   ```
5. **Update `sso-session/route.js`** — same fix as middleware:
   ```js
   // Current (line 28):
   const userData = await ssoClient.verifyToken(accessToken)
   // Fixed:
   const userData = await ssoClient.getMe(accessToken)
   ```
6. **Verify no other callers** import the removed methods by searching for `ssoClient.` across `sp-dash/`

### Verification
- `sso-auth.js` middleware works end-to-end (login → session check → protected API)
- `sso-session/route.js` returns proper session data
- All remaining 8 client methods return correctly from SSO Worker
- `node --check` on all modified files

---

## Phase 10: Flag Legacy `sp-dash/lib/auth-client.js`

**Files**: `sp-dash/lib/auth-client.js` (flag only — no action yet)
**Est. time**: ~5 min
**Risk**: Low

### Finding

`sp-dash/lib/auth-client.js` (398 lines) is a standalone frontend auth client that:
- Uses **`sessionStorage`** for token storage (the SSO auth-client pattern requires in-memory only)
- Has its own auto-refresh timer polling every 30 seconds
- Does **NOT** use `@rareminds-eym/auth-client`
- Calls `POST /api/auth/sso-login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/session`

This predates the SSO auth-client package and is a **legacy duplicate**.

### Recommended Action

Per legacy code policy: ask user whether to keep, remove, or refactor.

**Option A (Keep)**: No changes — the frontend works as-is. Risk of drift increases over time.
**Option B (Remove)**: Switch all consumers to `@rareminds-eym/auth-client`. Requires frontend testing to ensure compatibility.
**Option C (Refactor)**: Replace internals with `@rareminds-eym/auth-client` while keeping the same public API so existing consumers don't break.

### Verification
- Flag file with a `// LEGACY: Consider migrating to @rareminds-eym/auth-client` comment at the top

---

## Files to Touch (Complete)

| File | Phase | Change |
|------|-------|--------|
| `lib/response-utils.js` | 1 | **Create** — shared respondError/respondJson |
| `app/api/auth/sso-login/route.js` | 1, 5 | Import from shared utility + hardening + missing logging |
| `app/api/auth/login/route.js` | 1, 6 | Replace inline errors + SSO migration |
| `app/api/auth/refresh/route.js` | 1, 7 | Replace inline errors + fix catch block + remove dead code |
| `app/api/auth/sso-session/route.js` | 1, 9 | Replace inline errors + fix `verifyToken` → `getMe` |
| `app/api/auth/logout/route.js` | 1, 7 | Replace inline error + fix catch block logging |
| `app/api/auth/forgot-password/route.js` | 2, 6 | Standardize error shape + SSO migration |
| `app/api/auth/session/route.js` | 2 | Standardize error shape (if compatible) |
| Frontend files (TBD) | 2 | Update deprecated error shape parsing |
| `.eslintrc.cjs` | 3 | **Create** — ESLint config |
| `package.json` | 3, 4 | Add lint + test scripts |
| `__tests__/api/auth/sso-login.test.js` | 4 | **Create** — auth route tests |
| `lib/sso-service-client.js` | 7, 9 | Fix `refresh`/`logout` method names + args; remove 18 dead methods; fix `updateMembershipStatus` args |
| `lib/middleware/sso-auth.js` | 9 | Replace `verifyToken(accessToken)` with `getMe(accessToken)` |
| `skillpassport/functions/lib/rpc-types.ts` | 8 | Add 4 missing methods; fix 2 incomplete return types |
| `lib/auth-client.js` | 10 | Add legacy flag comment |

---

## Risk Assessment

| Concern | Mitigation |
|---------|------------|
| Changing `forgot-password` shape could break frontend | Phase 2 requires frontend verification before proceeding |
| Phase 6 SSO migration could break existing auth flows | Separate scoping — not bundled with earlier phases |
| Shared utility could be imported before it exists | Create utility file first, update routes second |
| No existing test patterns to follow | Check `auth-core` or `auth-client` for existing test patterns |
| ESLint may flag many existing issues | Run with `--fix` first, then manually address remaining |
| Body size limit via `content-length` header is unreliable | Document that `content-length` may be absent with chunked encoding |
| `refresh/route.js` catch fix changes string matching — could send wrong status | Map every unique error message from SSO Worker before deploying |
| `rpc-types.ts` update could reveal type errors in callers | Fix callers after updating types; review each change |
| Switching `refreshSession()`/`logoutSession()` from object to positional args | Verify `sso-service-client.js` passes 3 positional params matching SSO Worker signature |
| Removing 18 non-existent RPC methods could break hidden callers | Search for all `ssoClient.*` usages before removal; fix `verifyToken` callers in middleware + sso-session |
| `getMe(accessToken)` may return different data than `verifyToken(token)` | Verify the return shape of `getMe()` matches what middleware expects |

---

## Dependencies

- **Phase 1**: None (standalone utility extraction)
- **Phase 2**: Frontend team verification of error consumers
- **Phase 3**: None
- **Phase 4**: Test framework decision (Vitest vs Jest)
- **Phase 5**: None (standalone hardening)
- **Phase 6**: Separate scoping effort required
- **Phase 7**: Partially depends on Phase 1 (`respondError` utility) — catch fix can use inline `NextResponse.json` as fallback. The binding method name fix is independent of any other phase.
- **Phase 8**: Independent — but should verify SSO Worker method signatures are up-to-date first
- **Phase 9**: Depends on Phase 7 (method name fixes). Independent of Phase 1.
- **Phase 10**: Independent (flag only)

---

## Effort Summary

| Phase | Files | Est. Time | Risk | Priority |
|-------|-------|-----------|------|----------|
| 1: Shared utility | 6 (1 create, 5 update) | ~15 min | Low | High |
| 2: Standardize shapes | 2-5 files | ~30 min + verification | Medium | Medium |
| 3: ESLint | 2 (1 create, 1 update) | ~30 min | Low | Medium |
| 4: Tests | 2 (1 create, 1 update) | ~2-3 hours | Low | High |
| 5: Hardening | 1-3 files | ~15 min | Low | Low |
| 6: SSO migration | 2+ files | TBD (separate plan) | Medium-High | Low |
| 7: Fix refresh+logout | 3 files | ~45 min | Medium | **Critical** |
| 8: Update rpc-types | 1 file | ~15 min + verification | Low | Medium |
| 9: Rewrite sso-service-client | 3 files | ~1-2 hours | Medium | **Critical** |
| 10: Legacy auth-client flag | 1 file | ~5 min | Low | Low |
| **Total (Phases 1-5, 7-10)** | ~18-26 files | **~5-8 hours** | | |

---

## Quick Start

For the fastest impact on production reliability, execute in this order:

1. **Phase 7** (~45 min) — Fix `refresh`/`logout` method name mismatches + catch blocks. **This unblocks broken SSO session management** (currently returns 500 on every token refresh).
2. **Phase 9** (~1-2 hr) — Rewrite `sso-service-client.js` to 8 correct methods; fix `verifyToken` callers (`sso-auth.js`, `sso-session/route.js`). **This unblocks the SSO middleware** (currently breaks on every request).
3. **Phase 1 + Phase 5** combined (~30 min) — Shared error utility + hardening + missing logging on `sso-login/route.js`
4. **Phase 4** (~2-3 hr) — Tests catch regressions before other changes
5. **Phase 3** (~30 min) — ESLint baseline established
6. **Phase 8** (~15 min) — Update stale `rpc-types.ts`
7. **Phase 2** (~30 min + verification) — Consistent error shapes across routes
8. **Phase 10** (~5 min) — Flag legacy `auth-client.js`
9. **Phase 6** — Separate effort requiring deeper analysis
