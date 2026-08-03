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

## Production rollout — 2026-08-03 21:13 GMT+7

Completed with explicit approval against `chunks-lms` (`ekubetkxfcuxlyahesrl`):

1. Applied additive migration `20260803141559_staff_usernames.sql`.
2. Set `USERNAME_LOGIN_ALLOWED_ORIGINS` to the exact immutable and branch-alias URLs for PR #26.
3. Deployed `username-login` version 1 with gateway JWT verification disabled.
4. Verified both Preview origins return CORS preflight HTTP 200, while invalid credentials return one generic HTTP 401 response with `Cache-Control: no-store`.
5. Verified two historical staff aliases were assigned and the throttle table/function remain inaccessible to `anon`.
6. Re-ran Supabase advisors. The throttle table's “RLS enabled with no policy” notice is intentional: client grants are revoked, no client policy exists, and only `service_role` can execute the throttle function. Other security/performance findings predate this migration.

Not deployed in this rollout:

- no new `admin-staff-account`, `live-test-generation`, or `create-users` code was deployed; setting the shared Edge secret caused Supabase to roll their deployment version numbers while preserving their prior code hashes;
- the production web artifact was not changed;
- no Storage metadata or object was changed.

Before any future `db push`, recover/reconcile the six hosted `20260801...` migration files absent from `master`. Deploy the updated `admin-staff-account` only together with a compatible web promotion; the currently hosted web still sends the older account payload.

Never place `SUPABASE_SERVICE_ROLE_KEY` in Vite/Vercel browser variables. Edge Functions receive server secrets from Supabase.

Allowed magic-link origins must include:

- `http://localhost:5173/**`
- the exact Vercel Preview branch alias
- `https://chunks-lms.vercel.app/**`

## Preview aliases

Current username-login Preview for PR #26:

`https://chunks-lms-git-feat-username-login-865d84-genshai-11s-projects.vercel.app`

Previous standalone-test Preview:

`https://chunks-lms-git-feat-standalone-lear-8567b4-genshai-11s-projects.vercel.app`

A new push may receive a different immutable deployment URL while retaining its branch alias.

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
- PR #26 GitHub CI and Vercel Preview checks passed before the approved production backend rollout recorded above.

## Rollback

- Web: redeploy tag `preview-standalone-tests-20260719-2302` / commit `13e3dab`.
- Username endpoint: remove the Preview origins and disable/delete `username-login`; email login remains available.
- Database: leave the additive nullable username column and throttle objects in place unless a separately reviewed rollback migration is required; deleting them is not necessary to restore email login.
- Auth settings: no provider change is part of this release; restore recorded redirect values if they are changed later.
