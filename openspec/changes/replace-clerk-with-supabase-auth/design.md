## Context

Hosted Supabase already has `public.users.auth_user_id`, `staff_roles`, `auth.uid()` helpers, RLS, and an `auth.users` provisioning trigger. The remaining Clerk frontend bypasses native session persistence and can issue unauthenticated REST calls.

## Decisions

1. One browser `SupabaseClient` owns Auth and data access with persisted, refreshed sessions and URL callback detection.
2. Staff roles come only from active `staff_roles`; Auth metadata and frontend email allowlists never authorize.
3. Signup creates/links a domain user through the existing trigger. Only explicit database grants authorize a workspace.
4. External OAuth providers are deferred; the runtime exposes only Supabase email/password and magic-link flows.
5. Learners remain outside staff Auth and use signed access links.
6. Clerk columns remain rollback evidence but have no runtime call site.

## Risks and mitigations

- **No-role signup**: show a clear access-denied state and never provision a workspace.
- **Identity duplication**: lookup/provision by `auth_user_id` and preserve stable `public.users.id`.
- **Preview redirect mismatch**: document and verify exact Vercel branch alias before any remote Auth setting change.

## Rollback

Redeploy tag `preview-standalone-tests-20260719-2302` / commit `13e3dab`. Database identity links and legacy Clerk references remain intact.
