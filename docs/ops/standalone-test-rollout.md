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

No deletion has been performed. Exact impact queries, table-by-table backup, guarded SQL, and restore steps will be added before the final destructive confirmation gate.

## Release gates

1. Local implementation and CI.
2. Local database/RLS tests when Docker is available.
3. Review exact hosted impact counts and migration SQL.
4. Clean commit and release-candidate tag.
5. Explicit destructive/database/Storage/Edge approval.
6. One learner + one session canary.
7. Separate preview/production approval.

## Rollback outline

- Disable standalone routes before reverting data.
- Restore deleted test-only rows from the reviewed backup.
- Redeploy the downloaded Edge v2 source above.
- Keep narration Storage objects until database and application restore verification completes.
- Verify existing live session and Analysis paths after rollback.
