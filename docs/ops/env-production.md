# Production environment variables

## Vercel Preview and Production

| Name | Example | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Hosted project URL |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` or legacy anon JWT | Public browser key only |
| `VITE_AUTH_BYPASS` | unset / `false` | **Never true in production** |

Clerk variables, Clerk JWT bridging, and `VITE_STAFF_*_EMAILS` are no longer used. Staff roles are active rows in `public.staff_roles`.

## GitHub Actions CD

Same `VITE_*` values as above, plus:

| Name | Notes |
|---|---|
| `VERCEL_TOKEN` | Deploy token |
| `VERCEL_ORG_ID` | From `vercel link` |
| `VERCEL_PROJECT_ID` | From `vercel link` |

## Local production-like

```env
VITE_SUPABASE_URL=https://ekubetkxfcuxlyahesrl.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable/anon key>
VITE_AUTH_BYPASS=false
```

## Supabase Auth configuration

- Email signup/sign-in and magic links are native Supabase Auth operations.
- Email confirmation follows hosted Auth settings.
- External OAuth providers are intentionally deferred and are not shown in the application.
- Configure exact local/Preview/Production redirects for magic links.
- Authentication creates/links the domain User; authorization requires an active database `staff_roles` grant.

See [supabase-auth.md](./supabase-auth.md).
