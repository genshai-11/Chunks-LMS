# Standalone learner test rollout

**Status:** canonical database replacement and private Storage baseline are applied. Package-first Resources, Audio Preparation, current-hash readiness, signed playback, and runner sequencing are implemented locally. Migration `20260720113000_current_narration_readiness.sql`, Edge v4, paid generation, preview promotion, and production Hosting remain separately gated.

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

## Historical hosted data impact — pre-replacement discovery

Current read-only inspection found:

- one legacy resource, eight blocks, 80 items;
- one published compatibility package/version, eight sections, 80 items;
- one completed V2 test Learning Session and ten linked attempts;
- zero narration variants and generation jobs;
- no `narration-audio` bucket.

At discovery time no deletion had been performed. The later authorized replacement is recorded in the production receipt below.

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

## Local validation results — 2026-07-20 19:04 GMT+7

- OpenSpec strict validation: **11 passed, 0 failed**.
- Import tests: **6 passed**.
- Web tests: **141 passed across 36 files**.
- TypeScript typecheck: **passed**.
- Production build: **passed**; existing bundle-size/dynamic-import warnings remain.
- Native Oxlint: no new errors; three pre-existing warnings remain in `StaffSessionContext.tsx`, `main.tsx`, and `TeacherObservePage.tsx`.
- Edge v4 source check: **passed** with `npx deno check --node-modules-dir=auto`; v4 adds server-side 9Router model discovery and explicit one/selected/all generation controls.
- SQL/RLS migration replay and the new current-hash pgTAP test: **blocked — Docker/Supabase local stack unavailable**.
- Open deployment gates: new readiness migration, Edge v4, paid TTS, package publication, and production Hosting.
- Preview safety: Audio Preparation probes Edge capabilities and disables Generate/Play against deployed Edge v2, so saving scripts cannot accidentally invoke old paid generation behavior.

## Earlier local validation results — 2026-07-19

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

## Audio workflow preview receipt — 2026-07-20 19:10 GMT+7

- Source commit: `858460de6ecfc37a8a67107f2329aa4e8278518c`
- Annotated rollback tag: `standalone-test-audio-rc.1`
- Vercel deployment: `dpl_FeHYfMQq6NyqSkMKuTHqSKwwzpm1`
- Preview URL: `https://chunks-2v5atkq1x-genshai-11s-projects.vercel.app`
- Status: **Ready**, target **preview**; access is protected by Vercel SSO.
- Production Hosting was not changed.
- Migration `20260720113000_current_narration_readiness.sql` was not applied.
- Edge v3 was not deployed; preview capability detection therefore disables Generate and Play.
- No paid TTS, package publication, or narration approval was invoked.

## TTS v4 production receipt — 2026-07-20 19:54 GMT+7

- Source commits:
  - `554f382f3674e868c8f469e3a75355362b67d6f4` — live 9Router model discovery and one/selected/all generation
  - `5b0870634a5682eb6ba461ef22834dfa447f989c` — duplicate paid-generation guard
- Rollback tags:
  - `standalone-test-tts-v4-rc.1`
  - `standalone-test-tts-v4.1-rc.1`
- Database migration `20260720113000_current_narration_readiness.sql`: **applied**, local/remote migration parity confirmed, remote error-level lint passed.
- `live-test-generation`: capability contract v4 deployed as active Supabase platform Function version 3; capability smoke passed exact scripts, signed playback, model discovery, selected batch generation, and explicit paid-generation flags.
- 9Router secrets were present by name; no secret value was displayed.
- Live 9Router discovery returned 16 current model IDs for the canary. Selected model: `gemini/gemini-2.5-flash-preview-tts`.
- Bilingual Session 1 intro canaries:
  - Vietnamese variant `2038c469-96b5-4774-a1ef-3c0ab068b8df`
  - English variant `1dd70d93-f73f-4b82-95e4-15cfe114355b`
  - Both generated successfully as private WAV assets and played through short-lived signed URLs.
  - Both remain `generated`, not approved; human listening/approval remains mandatory.
- Production audio state after canary: 2 variants, 2 generated assets, 2 successful current canary jobs. Historical job records also contain 11 failed OpenAI-provider attempts from before this canary.
- Cost-control canary passed: with one generated intro, **Select missing / stale** selected exactly 10 items and excluded the generated intro.
- Preview deployments:
  - TTS v4: `dpl_uzxPqUC6dBBSJF1JaygMSfesZXKP`
  - paid-cost guard: `dpl_HvAvSYFyKiEpE2NzYvT1uAWuMAFj`
- Production Vercel deployment: `dpl_9wnuyY5qj2TKAzWkymJTSjVoVR3h`, status **Ready**, aliased to `https://chunks-lms.vercel.app`.
- Authenticated production canary passed: 16 models loaded, English generated state persisted, and signed playback was active.
- Canonical Package Version remains `draft`; bulk generation, human approvals, and publication intentionally remain open so narration is not frozen before review.

## Resources v5 production receipt — 2026-07-20 20:20 GMT+7

- Source commit: `6dc89fc9950ffcb6c625a873121323d0f9baaac6`
- Rollback tag: `standalone-test-resources-v5-rc.1`
- Deleted UI surfaces: `/admin/resources/advanced` and `/admin/integrity`; all corresponding imports, routes, navigation links, and page files were removed.
- Signed-in auth actions were reduced to one compact Account menu; mobile hides extra backend sync icon buttons.
- Migration `20260720133000_editable_spoken_scripts_and_publish_gate.sql`: **applied**, migration parity confirmed, remote error-level lint passed.
- Exact item narration is stored independently in `spoken_script_vi` / `spoken_script_en`; canonical source prompts remain unchanged.
- Edge Function platform version 4 is active and uses exact script overrides before deterministic Số/Number fallbacks.
- Canary override persisted across reload and production promotion: Session 1 Item 1 Vietnamese is `Câu 1. Cảnh sát giao thông đứng ở ngã tư mỗi buổi sáng.` while its source sentence remains unchanged.
- Guarded publication requires all eight Sessions ready for both Vietnamese and English using the chosen model IDs, then records an immutable snapshot hash.
- Current publication blocker is visible and correct: `VI 0/8 · EN 0/8`; Publish remains disabled, so the draft cannot yet appear in one-to-one Test setup.
- Preview deployment: `dpl_AHPx5JdbxhWJYvYUcbgFsmVDWq1j`, status **Ready**.
- Production deployment: `dpl_H4KHaexUigg7YxJoKAgtN1w3rudY`, status **Ready**, aliased to `https://chunks-lms.vercel.app`.
- Authenticated production checks passed: no Advanced/Integrity links, compact Account menu present, publication disabled at 0/8 + 0/8, and Câu 1 override loaded from Supabase.

## Rollback outline

- Preview rollback: keep production untouched; remove or ignore deployment `dpl_FeHYfMQq6NyqSkMKuTHqSKwwzpm1` and return to tag `standalone-test-audio-rc.1`.
- Disable standalone routes before reverting data.
- Restore deleted test-only rows from the reviewed backup.
- Redeploy the downloaded Edge v2 source above.
- Keep narration Storage objects until database and application restore verification completes.
- Verify existing live session and Analysis paths after rollback.
