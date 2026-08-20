## 1. Runtime cutover

- [x] 1.1 Remove Clerk dependency, provider, hooks, environment contract, and JWT bridge
- [x] 1.2 Enable persisted native Supabase sessions and provider-neutral app bootstrap
- [x] 1.3 Implement password signup/sign-in, magic link, and sign-out; defer external OAuth
- [x] 1.4 Resolve roles from `auth_user_id` and active database `staff_roles`
- [x] 1.5 Preserve stable domain identities during workspace synchronization
- [x] 1.6 Add unique staff usernames and a non-enumerating server-side username/password session path

## 2. UX and documentation

- [x] 2.1 Replace Clerk copy throughout staff and learner-facing surfaces
- [x] 2.2 Document Supabase Auth configuration, deferred OAuth scope, and rollback
- [x] 2.3 Update V1 identity/domain wording and ADR
- [x] 2.4 Document username-login deployment, origin allowlist, rollback, and email fallback

## 3. Verification and preview

- [x] 3.1 Add/update auth role and session tests
- [x] 3.2 Run strict OpenSpec, tests, lint, typecheck, and production build
- [x] 3.4 Add username normalization/session tests and rerun full CI before commit
- [ ] 3.3 Commit/tag/push the feature branch and smoke-test Vercel Preview
