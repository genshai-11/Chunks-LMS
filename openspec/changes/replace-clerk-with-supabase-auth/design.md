## Context

Hosted Supabase already has `public.users.auth_user_id`, `staff_roles`, `auth.uid()` helpers, RLS, and an `auth.users` provisioning trigger. The remaining Clerk frontend bypasses native session persistence and can issue unauthenticated REST calls.

## Decisions

1. One browser `SupabaseClient` owns Auth and data access with persisted, refreshed sessions and URL callback detection.
2. Staff roles come only from active `staff_roles`; Auth metadata and frontend email allowlists never authorize.
3. Signup creates/links a domain user through the existing trigger. Only explicit database grants authorize a workspace.
4. External OAuth providers are deferred; the runtime exposes only Supabase email/password and magic-link flows.
5. Learners remain outside staff Auth and use signed access links.
6. Clerk columns remain rollback evidence but have no runtime call site.
7. `public.users.username` is an optional normalized login identifier. Email inputs use native Auth directly; username inputs use an origin-restricted Edge Function that resolves the linked active staff identity and returns a native session without returning the email.

## Risks and mitigations

- **No-role signup**: show a clear access-denied state and never provision a workspace.
- **Identity duplication**: lookup/provision by `auth_user_id` and preserve stable `public.users.id`.
- **Preview redirect mismatch**: document and verify exact Vercel branch alias before any remote Auth setting change.
- **Username enumeration / email disclosure**: do not expose an anonymous username-to-email RPC; return the same credential failure and execute the same lookup/Auth request shape for unknown, inactive, no-role, and wrong-password cases.
- **Public function abuse**: throttle by HMAC-only source-IP and source-IP/username buckets in a service-role-only database function; never persist raw IPs, usernames, or passwords.
- **Public function surface**: `username-login` disables gateway JWT verification because no session exists yet, but restricts browser origins, never logs credentials, and keeps service-role secrets server-side.

## Rollback

Redeploy tag `preview-standalone-tests-20260719-2302` / commit `13e3dab`. Database identity links and legacy Clerk references remain intact.
