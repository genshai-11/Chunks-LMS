# Standalone test security review

**Review date:** 2026-07-19  
**Remote mutation:** none

## Hosted baseline findings

Supabase security advisors reported:

- 21 `anon`-executable `SECURITY DEFINER` functions in exposed `public` schema;
- 25 `authenticated`-executable `SECURITY DEFINER` functions;
- relevant exposed functions included generation, narration, approval, live result transitions, and learner CPD reporting;
- `generate_test_item`, `generate_narration`, `approve_generated_asset`, `get_learner_cpd_records`, and `calculate_learner_cpd_report` had default/public execution and no hardened function search path;
- `test_packages_staff_read` rendered as `v.package_id = v.id`, preventing intended non-Admin published package reads;
- leaked-password protection is disabled at the Auth project level.

## Local corrective migration

`20260719153103_harden_test_catalog_security.sql`:

- fixes the correlated package policy;
- revokes PUBLIC/anon execution from test generation/narration/approval and CPD functions;
- makes raw learner CPD records service-role-only;
- adds actor authorization to the authenticated CPD summary;
- hardens function search paths;
- keeps generation RPCs authenticated/service-role only with existing Admin checks.

`20260719153107_standalone_test_schema.sql`:

- creates separate standalone tables with RLS enabled;
- adds explicit Data API grants;
- uses a private same-organization Teacher/Learner helper;
- grants direct write access only where RLS must support setup rows;
- keeps attempt/event/snapshot writes behind future transition RPCs.

## Tests added

- `supabase/tests/test_catalog_security_test.sql`
- `supabase/tests/standalone_test_rls_test.sql`
- `supabase/tests/test_catalog_replacement_test.sql`

## Verification status

- TypeScript invariant tests: pass.
- Import tests: pass.
- Local SQL/RLS tests: **blocked** because Docker/Supabase local stack is not running.
- Hosted advisors after migration: not run because the migration has not been approved/applied remotely.

## Residual actions before remote apply

1. Run local `supabase db reset` and `supabase test db` with Docker.
2. Review every security-definer function still exposed outside this feature’s scope.
3. Run security advisors after local migration replay.
4. Decide separately whether to enable leaked-password protection.
5. Do not deploy or apply until exact destructive counts/SQL and restore path receive final approval.
