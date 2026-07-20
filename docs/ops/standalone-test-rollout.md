# Standalone learner test rollout

**Status:** local implementation only — no remote database, Storage, Edge, or Hosting changes approved.

## Baseline

- Worktree: `Chunks-LMS-standalone-test`
- Branch: `feat/standalone-learner-tests`
- Source baseline: `bugfix/observe-session-fixes` at `b4f2e04`
- Hosted Supabase project: `chunks-lms` / `ekubetkxfcuxlyahesrl`
- Supabase CLI: 2.109.0

## Hosted migration reconciliation

The new worktree was linked with:

```powershell
supabase link --project-ref ekubetkxfcuxlyahesrl --yes
```

`supabase migration fetch --linked` recovered these hosted migrations absent from the bugfix baseline:

- `20260719025253_supabase_auth_signed_learner_access.sql`
- `20260719033446_flexible_immutable_test_packages_measurement_catalogs.sql`
- `20260719041046_hosted_live_test_v2_migration_prep.sql`
- `20260719054000_live_test_generation_and_tts.sql`
- `20260719065000_learner_cpd_reporting.sql`
- `20260719071000_auth_trigger_google_oauth_provisioning.sql`
- `20260719072000_seed_cvr_vocabulary_items.sql`

Fetched hosted SQL is retained as the historical source. Later semantic edits found on `fix/supabase-auth-resource-recovery` will be implemented as new corrective migrations rather than rewriting applied migration history.

## Edge Function rollback baseline

Downloaded deployed function: `live-test-generation`, hosted version 2, JWT verification enabled.

- `index.ts` SHA-256: `787503405937a9369f067c67bde942b1251115686fdb8f950be73f79090b69d8`
- `adapters.ts` SHA-256: `0b465dec7cbfb5ef33aa3dd84c832646d3d94377eed2f398839801215b0d1e3b`

The deployed source supports stable generation/narration/approval actions. The later unreviewed `generateCVRPreview` addition is excluded from this feature.

## Canonical workbook

- File: `chunks-resourcce/Chunks Resource.xlsx`
- SHA-256: `1022fd3d09fc17e8b07be3e48b67bb6bae5eaac01d2c1498d5933f258a3185d6`
- Parser: exact-pinned `read-excel-file@9.3.2`
- Dependency audit: zero known vulnerabilities at installation time.

## Known hosted data impact — discovery only

Current read-only inspection found:

- one legacy resource, eight blocks, 80 items;
- one published compatibility package/version, eight sections, 80 items;
- one completed V2 test Learning Session and ten linked attempts;
- zero narration variants and generation jobs;
- no `narration-audio` bucket.

No deletion has been performed.

### Exact preflight impact query

Run immediately before final confirmation:

```sql
select private.obsolete_test_catalog_scope() as deletion_scope,
       private.obsolete_test_catalog_counts(private.obsolete_test_catalog_scope()) as delete_counts;
```

Current discovery expectation is one legacy resource, eight blocks, 80 legacy items, one compatibility package/version, eight V2 sections, 80 V2 items, one completed test Learning Session, ten attempts, and their questions/events/snapshots. Any drift requires a new preview and confirmation.

### Backup scope and restore path

Before apply, export all rows identified by `deletion_scope`, including dependent Learning Session questions/attempts/events/snapshots, compatibility mappings, package/version/section/item/measurement/CCI rows, legacy resource/block/item rows, narration/generation/audio metadata, and the import preview receipt. Store the encrypted export outside Git and record its checksum.

Restore order is the reverse dependency order: organizations/users remain in place; restore legacy resources/catalog/CCI, mappings, Learning Session, Session Questions, attempts, snapshots, then events. Verify row counts and CPD report output before re-enabling routes. The downloaded Edge v2 source provides the Functions restore path.

The generated SQL artifact calls preview only. The only write path is the reviewed `apply_test_catalog_replacement(import_run_id, confirmation_token)` RPC after final approval.

## Release gates

1. Local implementation and CI.
2. Local database/RLS tests when Docker is available.
3. Review exact hosted impact counts and migration SQL.
4. Clean commit and release-candidate tag.
5. Explicit destructive/database/Storage/Edge approval.
6. One learner + one session canary.
7. Separate preview/production approval.

## Local validation results — 2026-07-19

- OpenSpec strict validation: **10 passed, 0 failed**.
- Import tests: **6 passed**.
- Web tests: **138 passed across 34 files**.
- TypeScript typecheck: **passed**.
- Production build: **passed**.
- Oxlint: no new standalone/resource errors; three pre-existing warnings remain in `StaffSessionContext.tsx`, `main.tsx`, and `TeacherObservePage.tsx`.
- Bundle warning: main JS chunk is approximately 1.59 MB; existing code-splitting work remains outside this change.
- SQL/RLS migration replay: **blocked — Docker/Supabase local stack unavailable**.
- Remote migration/apply/deploy: **not run**.

## Production migration receipt — 2026-07-20 18:09–18:24 GMT+7

- User authorized production backup, full schema migration, and real canonical data replacement.
- Logical backup: `chunks-lms-pre-migration-20260720-1809-logical.json` in the Craft session data folder.
  - Schemas: `public`, `auth`, `storage`
  - Tables: 66
  - Rows: 8,468
  - Export errors: 0
  - SHA-256: `c053a333e93ce11581e0aefbab56a475d25589509c4013808e02ba2f596deff6`
- Hosted PITR was unavailable; CLI reported `PITR=false` and no backup timestamps.
- Applied the seven reviewed migrations through `20260720100012_native_auth_account_role_linking.sql`.
- First guarded replacement run `979fbb37-d195-4a4d-b4d0-b0260d615f8f` failed safely with `Package Version not found`; the inner transaction rolled back all catalog/history changes.
- Added/applied tagged hotfix `20260720111613_fix_guarded_catalog_reset_triggers.sql` so only active allowlisted reset IDs can bypass child immutability triggers.
- Fresh guarded run `69579d88-ccb6-4f0c-a2c2-a88379ecb1e7` succeeded:
  - Deleted obsolete test-only graph: 1 package/version, 8 sections, 80 items, 8 measurement snapshots, 1 Learning Session, 10 questions, 10 attempts, 60 events, 10 snapshots, and legacy/mapping rows.
  - Inserted canonical draft `Pre-test / draft-v1`: 8 sessions, 80 items, 8 CCI Name/Ampe definitions.
  - Retained warning: Session 1 / Item 10 source CCI is `cci-002` while Session 1 uses `cci-001`.
- Post-check preserved 22 Users, 5 Organizations, 14 Classes, and 20 Enrollments exactly. Assessment totals changed only by the previewed test-only rows.
- Applied `20260720111950_fix_learner_access_and_extension_paths.sql` after remote lint exposed pre-existing learner-token SQL errors.
- Rolled-back learner-link smoke test: 1 issued token, 1 valid verification row.
- Final remote lint: no errors; only two unused-variable warnings remain in legacy generation RPCs.
- Narration bucket exists and is private; narration variants/assets remain 0 pending explicit generation/approval.

## Rollback outline

- Disable standalone routes before reverting data.
- Restore deleted test-only rows from the reviewed backup.
- Redeploy the downloaded Edge v2 source above.
- Keep narration Storage objects until database and application restore verification completes.
- Verify existing live session and Analysis paths after rollback.
