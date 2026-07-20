## Why

The web client still authenticates staff with Clerk and conditionally bridges Clerk JWTs into Supabase. In Vercel Preview this leaves REST requests without a valid native Supabase session and causes `401` responses. The hosted database already links native `auth.users` identities to stable domain users and owns staff grants in `staff_roles`.

## What Changes

- **BREAKING (authentication provider)**: remove Clerk runtime/dependency/environment configuration and use native Supabase Auth.
- Add email/password account creation and sign-in, magic-link sign-in, Google OAuth entry, persistent refreshable sessions, and sign-out.
- Resolve Admin/Teacher authorization only from database-owned active `staff_roles` linked by `auth_user_id`.
- Keep newly created no-role accounts signed in but denied protected staff workspaces with a clear message.
- Preserve signed learner-link access and stable domain user UUIDs.

## Capabilities

### Modified Capabilities

- `identity-access`: native Supabase Auth replaces Clerk for staff identity and protected REST/RLS access; Learner signed-link access remains separate.

## Impact

- Web auth provider, gate, app bootstrap, Supabase client, workspace provisioning, environment contract, generated DB types, dependency lockfile, tests, identity documentation, and preview configuration guidance.
- No destructive identity rewrite, production database migration, or production deployment is included.
