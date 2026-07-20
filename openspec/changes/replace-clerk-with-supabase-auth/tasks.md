## 1. Runtime cutover

- [x] 1.1 Remove Clerk dependency, provider, hooks, environment contract, and JWT bridge
- [x] 1.2 Enable persisted native Supabase sessions and provider-neutral app bootstrap
- [x] 1.3 Implement password signup/sign-in, magic link, capability-gated Google OAuth, and sign-out
- [x] 1.4 Resolve roles from `auth_user_id` and active database `staff_roles`
- [x] 1.5 Preserve stable domain identities during workspace synchronization

## 2. UX and documentation

- [x] 2.1 Replace Clerk copy throughout staff and learner-facing surfaces
- [x] 2.2 Document Supabase Auth/OAuth redirect configuration and rollback
- [x] 2.3 Update V1 identity/domain wording and ADR

## 3. Verification and preview

- [x] 3.1 Add/update auth role and session tests
- [x] 3.2 Run strict OpenSpec, tests, lint, typecheck, and production build
- [ ] 3.3 Commit/tag/push the feature branch and smoke-test Vercel Preview
