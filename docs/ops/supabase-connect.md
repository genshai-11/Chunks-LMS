# Connect Chunks-LMS to hosted Supabase

## Important: which key?

| Key | Use in browser app? | Where |
|-----|---------------------|--------|
| **anon / public** | **Yes** | `VITE_SUPABASE_ANON_KEY` |
| **service_role** | **Never** | Server/scripts only (bypasses RLS) |

Do **not** copy this into Vite:

```js
// ❌ Wrong for this SPA — service role must never ship to the client
const supabaseKey = process.env.SUPABASE_KEY
```

Correct pattern (already in `web/src/lib/supabase.ts`):

```ts
import { createClient } from '@supabase/supabase-js'
// URL + anon from import.meta.env.VITE_*
const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
```

## Your project

| Item | Value |
|------|--------|
| Project | `chunks-lms` |
| Ref | `ekubetkxfcuxlyahesrl` |
| URL | `https://ekubetkxfcuxlyahesrl.supabase.co` |
| Region | ap-southeast-1 |

## 1. `web/.env`

```env
VITE_SUPABASE_URL=https://ekubetkxfcuxlyahesrl.supabase.co
VITE_SUPABASE_ANON_KEY=<Dashboard → Settings → API → publishable/anon>
# Local only — sync without signing in every time:
# VITE_AUTH_BYPASS=true
VITE_AUTH_BYPASS=false
```

Restart `npm run dev` after any `.env` change.

## 2. Migrations (schema)

From repo root (project already linkable via CLI):

```powershell
supabase link --project-ref ekubetkxfcuxlyahesrl
supabase db push
```

## 3. Verify connectivity

```powershell
npm run supabase:verify
```

Expect `✓` on organizations, courses, write probe.

## 4. Starter data (optional, non-destructive)

```powershell
supabase db query --linked --file supabase/seeds/production-starter.sql
```

Or create courses/classes in **Admin** UI after sign-in (preferred for real people).

## 5. How the app syncs

| When | What |
|------|------|
| Staff signed in (or `AUTH_BYPASS`) | Boot loads workspace from Supabase |
| Roster/schedule edits | Debounced **upsert** save (`saveWorkspaceToSupabase`) |
| Live Observe colors | Path RPCs in `live-assessment.ts` (not full workspace dump) |
| Ledger | Rebuilt from finalized snapshots when online |
| Top bar | “Supabase” badge = connected; use reload/push icons |

Sign-in required when `VITE_AUTH_BYPASS=false`. Sign-out no longer wipes local cache; cloud sync waits until sign-in again.

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Badge “Local only” | Missing `VITE_SUPABASE_*` or restart dev server |
| “Sign in to load…” | Supabase email-or-username/password or email magic-link sign-in; use bypass only locally |
| Save errors / empty cloud | `supabase db push`; check RLS demo policies on foundation tables |
| service_role in frontend | Remove it; use anon key only |

## 7. Vercel production

Set the same `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel env. **Never** set `VITE_AUTH_BYPASS=true` on production. Configure Auth redirects per [supabase-auth.md](./supabase-auth.md).
