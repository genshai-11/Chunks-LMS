# ADR 0007: Native Supabase Auth for staff

**Status:** Accepted  
**Date:** 2026-07-20  
**Supersedes:** [ADR 0002](./0002-clerk-with-supabase-third-party-auth.md)

## Context

The browser used Clerk as the staff identity provider and conditionally bridged Clerk JWTs into Supabase. Preview requests could reach PostgREST without a valid native session and return `401`. The hosted database already links `auth.users.id` to stable `public.users.auth_user_id`, stores active Admin/Teacher grants in `staff_roles`, and evaluates RLS from `auth.uid()`.

## Decision

Admin and Teacher authentication uses native Supabase Auth. The browser Supabase client persists, refreshes, and detects callback sessions; the same native access token authenticates REST and Realtime.

Staff authorization remains database-owned:

- Auth identity proves who the visitor is.
- One stable domain User is linked by `auth_user_id`.
- Active `staff_roles` grants Admin/Teacher access.
- Auth metadata, frontend email allowlists, and retained Clerk columns never authorize.
- Signup may create/link an account, but a no-role account receives no staff workspace.

Email/password account creation/sign-in, confirmation, and magic links are supported. Staff may also sign in with a unique normalized username: an unauthenticated, origin-restricted Edge Function resolves only active database staff, performs native password authentication server-side, and returns a session without exposing the email. Username remains an identifier—not an authorization claim. External OAuth providers are deferred and have no runtime controls. Learners remain profile-only and use scoped signed links in V1.

## Consequences

- `@clerk/react`, Clerk environment settings, providers, hooks, and token bridges are removed.
- Legacy Clerk identifiers remain migration and rollback evidence until a separately reviewed cleanup.
- Magic-link redirects must allow each deployed origin; external OAuth requires a future reviewed change.
- Username login requires the additive username/throttle migration and a separately deployed `username-login` Edge Function with `verify_jwt = false`, generic credential failures, HMAC-only five-minute rate-limit buckets, a uniform dummy-Auth failure path, no-store responses, and an explicit origin allowlist.
- Rolling back the web app does not require rewriting identity rows.
