# Environment Variables Usage Guide

This document explains how to properly use environment variables in this project.

## Overview

Environment variables are used to configure the application without hardcoding sensitive information like API keys, database URLs, and other configuration values. This project uses the `dotenv` package to load environment variables from a `.env` file.

## Required Environment Variables

The following environment variables must be defined in your `.env` file:

```env
# Base URL for the application
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# CORS configuration
CORS_ORIGINS=*

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Session secret for JWT encryption (change in production)
SESSION_SECRET=your-super-secret-key-change-in-production
```

## Variable Types

### Public Variables (NEXT_PUBLIC_*)

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser and can be used in client-side code:

```javascript
// This is safe in client-side code
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
```

### Private Variables

Variables without the `NEXT_PUBLIC_` prefix are server-only and should never be exposed to client-side code:

```javascript
// This should only be used in server-side code
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
```

## Loading Environment Variables

### JavaScript (Node.js)

For JavaScript files, use the `dotenv` package:

```javascript
// ES6 modules
import { config } from 'dotenv'
config()

// CommonJS
require('dotenv').config()
```

Then access variables through `process.env`:

```javascript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
```

### Python

For Python files, use the `python-dotenv` package:

```python
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Access variables
supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
```

## Best Practices

### 1. Never Commit .env Files

The `.env` file should never be committed to version control. It's included in `.gitignore`.

### 2. Use Environment-Specific Files

For different environments, use:
- `.env.local` for local development
- `.env.production` for production
- `.env.development` for development

### 3. Validate Required Variables

Always validate that required environment variables are present:

```javascript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}
```

### 4. Don't Expose Private Variables to Client

Never use private environment variables in client-side code:

```javascript
// ❌ WRONG - Never do this in client-side code
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// ✅ CORRECT - Use only public variables in client-side code
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Common Patterns

### Server-Side Supabase Client

```javascript
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Private key for server-side operations
)
```

### Client-Side Supabase Client

```javascript
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
```

### Server Components Supabase Client

```javascript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

## Security Considerations

1. **Never expose service role keys to client-side code**
2. **Use strong session secrets in production**
3. **Rotate keys regularly**
4. **Use different keys for different environments**
5. **Monitor access to sensitive variables**

## Troubleshooting

### Missing Environment Variables

If you get errors about missing environment variables:

1. Check that your `.env` file exists and is properly formatted
2. Verify that you're loading dotenv correctly in your scripts
3. Ensure variable names match exactly (case-sensitive)

### Variables Not Loading

If environment variables aren't loading:

1. Make sure you're calling `config()` or `require('dotenv').config()` at the top of your file
2. Check that there are no syntax errors in your `.env` file
3. Verify that you're not trying to access variables before they're loaded