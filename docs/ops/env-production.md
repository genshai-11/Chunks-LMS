# Production environment variables

## Vercel (Production + Preview)

| Name | Example | Notes |
|------|---------|--------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_…` | Staff only |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | |
| `VITE_SUPABASE_ANON_KEY` | `eyJ…` | Public anon |
| `VITE_AUTH_BYPASS` | *(unset or false)* | **Never true in production** |
| `VITE_STAFF_ADMIN_EMAILS` | `you@school.edu` | Optional allowlist |
| `VITE_STAFF_TEACHER_EMAILS` | `t1@school.edu,t2@…` | Optional allowlist |

## GitHub Actions CD

Same `VITE_*` as above, plus:

| Name | Notes |
|------|--------|
| `VERCEL_TOKEN` | Deploy token |
| `VERCEL_ORG_ID` | From `vercel link` |
| `VERCEL_PROJECT_ID` | From `vercel link` |

## Local production-like

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
VITE_SUPABASE_URL=https://….supabase.co
VITE_SUPABASE_ANON_KEY=eyJ…
VITE_AUTH_BYPASS=false
VITE_STAFF_ADMIN_EMAILS=you@example.com
VITE_STAFF_TEACHER_EMAILS=you@example.com
```

## Clerk metadata (alternative to email allowlists)

User public metadata:

```json
{ "chunksRole": "admin" }
```

or

```json
{ "chunksRoles": ["admin", "teacher"] }
```

`staff` grants both admin and teacher surfaces.
