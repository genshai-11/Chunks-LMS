# Supabase staff Auth operations

## Browser environment

Required in Vercel Preview and Production:

```env
VITE_SUPABASE_URL=https://ekubetkxfcuxlyahesrl.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable/anon key>
VITE_AUTH_BYPASS=false
```

Clerk and `VITE_STAFF_*_EMAILS` variables are not used. Never put a Supabase secret/service-role key in Vite variables.

## Account lifecycle

1. Staff may sign up with email/password or request a magic link.
2. Hosted email confirmation is currently required.
3. The `auth.users` trigger links an existing domain email or creates one `public.users` row.
4. Authentication alone does not grant a workspace. An active `staff_roles` row must grant `admin` or `teacher`.
5. Admin implies Teacher surface access; disabled/no-role accounts remain denied.

## OAuth

The login UI reads `/auth/v1/settings` and displays Google only when the hosted provider is enabled.

Current verification on 2026-07-20: email enabled, signup enabled, confirmation required, Google disabled.

Before enabling Google in Supabase Dashboard → Authentication → Providers:

1. Obtain the approved Google OAuth client ID and secret; never invent or commit them.
2. Configure the Google callback URL shown by Supabase in Google Cloud.
3. Add allowed application redirect origins in Supabase URL Configuration:
   - `http://localhost:5173/**`
   - the exact Vercel preview branch alias
   - `https://chunks-lms.vercel.app/**`
4. Test a no-role account and a role-granted account in Preview first.
5. Record previous provider and redirect values before mutation.

## Preview alias

The previous tagged preview is:

`https://chunks-lms-git-feat-standalone-lear-8567b4-genshai-11s-projects.vercel.app`

A new push may receive a different immutable deployment URL while retaining the branch alias.

## Local validation — 2026-07-20

- OpenSpec strict validation: 11 passed, 0 failed.
- Import tests: 6 passed.
- Web tests: 136 passed across 35 files.
- TypeScript/build: passed; bundle reduced from the Clerk preview by about 121 KB uncompressed JS.
- Oxlint: no errors; the three existing Fast Refresh/Observe dependency warnings remain.
- Dependency audit: 0 vulnerabilities.
- Hosted migration dry-run: seven pending migrations, including `20260720100012_native_auth_account_role_linking.sql`; nothing applied.
- Local pgTAP: blocked because the local Supabase/Postgres stack is unavailable (`Failed to connect`).

## Rollback

- Web: redeploy tag `preview-standalone-tests-20260719-2302` / commit `13e3dab`.
- Auth data: no rollback is needed; native identities and domain links are preserved.
- OAuth settings: restore the recorded provider toggle and redirect list.
