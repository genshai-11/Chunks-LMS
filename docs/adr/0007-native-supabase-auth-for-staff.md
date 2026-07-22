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

Email/password account creation/sign-in, confirmation, and magic links are supported. External OAuth providers are deferred and have no runtime controls. Learners remain profile-only and use scoped signed links in V1.

## Consequences

- `@clerk/react`, Clerk environment settings, providers, hooks, and token bridges are removed.
- Legacy Clerk identifiers remain migration and rollback evidence until a separately reviewed cleanup.
- Magic-link redirects must allow each deployed origin; external OAuth requires a future reviewed change.
- Rolling back the web app does not require rewriting identity rows.
