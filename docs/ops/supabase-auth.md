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

1. Staff may sign in with email/password, username/password, or request an email magic link.
2. Hosted email confirmation is currently required.
3. The `auth.users` trigger links an existing domain email or creates one `public.users` row.
4. Authentication alone does not grant a workspace. An active `staff_roles` row must grant `admin` or `teacher`.
5. Admin implies Teacher surface access; disabled/no-role accounts remain denied.

## Authentication scope

Current runtime authentication is Supabase email/password account creation/sign-in, server-resolved username/password sign-in, plus magic links. Email confirmation is required by hosted Auth settings.

External OAuth providers, including Google, are intentionally deferred and have no UI or session API. A future OAuth change must separately approve credentials, provider configuration, redirects, and Preview validation.

## Username login

- `public.users.username` is nullable, lowercase, 3–32 characters, and unique case-insensitively.
- Existing staff with no username remain email-login compatible.
- Admin assigns Teacher usernames from **Admin → Accounts**.
- Email inputs call native `signInWithPassword` directly.
- Username inputs call the `username-login` Edge Function, which resolves the linked active staff Auth identity internally and returns access/refresh tokens for `setSession`.
- The function never returns the resolved email and returns one generic credential error for unknown, inactive, no-role, and wrong-password cases.
- Eligible and ineligible usernames follow the same database lookup count and password-Auth request shape; each ineligible attempt authenticates against a fresh reserved-domain dummy email and discards the result.
- A service-role-only database throttle allows 30 attempts per source IP and 8 per source-IP/username pair per five-minute window. It stores HMAC bucket hashes only—never raw IPs or usernames—and returns HTTP 429 when exhausted.
- Username never grants access; active `staff_roles` remains authoritative.

Required promote order after review:

0. Reconcile production migration history first. As of 2026-08-03, remote contains six `20260801...` migrations absent from `master`; do not run `db push` until those exact remote migrations are recovered/reconciled.
1. Apply `20260803124500_staff_usernames.sql`.
2. Configure `USERNAME_LOGIN_ALLOWED_ORIGINS` with any additional exact Preview origin(s), comma-separated. Production and local Vite origins are built in.
3. Deploy `username-login` with JWT verification disabled as declared in `supabase/config.toml`.
4. Deploy the updated `admin-staff-account` function so Admin can create/edit usernames.
5. Deploy the web preview and smoke both email and username login.

```powershell
# Production-impacting examples — run only after explicit approval.
supabase db push --linked
supabase functions deploy username-login --no-verify-jwt
supabase functions deploy admin-staff-account
```

Never place `SUPABASE_SERVICE_ROLE_KEY` in Vite/Vercel browser variables. Edge Functions receive server secrets from Supabase.

Allowed magic-link origins must include:

- `http://localhost:5173/**`
- the exact Vercel Preview branch alias
- `https://chunks-lms.vercel.app/**`

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

## Local validation — 2026-08-03 username login

- CodeGraph 1.5.0 index: current, 199 files / 3,290 nodes / 9,226 edges.
- Strict Deno checks: passed for `username-login`, `admin-staff-account`, and `live-test-generation`.
- OpenSpec strict validation: 11 passed, 0 failed.
- Import tests: 6 passed.
- Web tests: 152 passed across 38 files.
- Oxlint: no errors; the three existing Fast Refresh/Observe dependency warnings remain.
- TypeScript and production Vite build: passed.
- Dependency audit: root 0 vulnerabilities; web reports 4 high-severity findings (3 in the production tree: PostCSS and React Router chain). Remediation is outside this auth change; the suggested Router fix is forced/breaking.
- New pgTAP coverage is committed, but local execution remains blocked because Docker/Podman is unavailable.
- No migration or Edge Function was applied/deployed; production migration drift must be reconciled first.

## Rollback

- Web: redeploy tag `preview-standalone-tests-20260719-2302` / commit `13e3dab`.
- Auth data: no rollback is needed; native identities and domain links are preserved.
- Auth settings: no provider change is part of this release; restore recorded redirect values if they are changed later.
