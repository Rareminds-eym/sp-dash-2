# Fix for 405 Method Not Allowed Error

## Issue
```
POST http://localhost:3000/api/auth/sso-login 405 (Method Not Allowed)
```

## Root Cause
Next.js development server is not recognizing the API route changes. This happens when:
1. Route files are modified while server is running
2. Next.js cache is stale
3. Hot reload didn't pick up the changes

## Solution

### 1. **Restart Next.js Development Server**

**Stop the server:**
- Go to terminal where Next.js is running
- Press `Ctrl+C`

**Start the server:**
```bash
cd sp-dash-2
npm run dev
```

### 2. **Clear Next.js Cache (if needed)**
```bash
cd sp-dash-2
rm -rf .next
npm run dev
```

### 3. **Verify Route is Working**
After restart, test the login at: http://localhost:3000/login

## Expected Behavior After Restart

✅ **Login page loads** at http://localhost:3000/login
✅ **POST request works** to `/api/auth/sso-login`
✅ **Authentication flows** through SSO Worker
✅ **Successful login** redirects to dashboard

## Troubleshooting Steps

If still getting 405 after restart:

1. **Check file exists:**
   ```
   sp-dash-2/app/api/auth/sso-login/route.js
   ```

2. **Check export syntax:**
   ```javascript
   export async function POST(request) {
     // ... implementation
   }
   ```

3. **Check runtime setting:**
   ```javascript
   export const runtime = 'nodejs'
   ```

4. **Check Next.js logs** in terminal for any compilation errors

## Why This Happens

Next.js API routes use file-based routing. When you:
- Modify route files
- Change export functions
- Update runtime settings

The dev server sometimes doesn't hot-reload properly and needs a restart to recognize the changes.

## Prevention

To avoid this in the future:
- Restart Next.js dev server after major route changes
- Clear `.next` cache if experiencing persistent issues
- Use `npm run build` to check for compilation errors