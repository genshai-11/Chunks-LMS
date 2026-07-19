# Live Test V2 migration dry-run and rollback notes

**Ticket:** [Migrate existing hosted live-test records and one-time CSV data safely](https://github.com/genshai-11/Chunks-LMS/issues/7)  
**Status:** local-only preparation; no hosted data or remote migrations were modified.

## Safety boundary

- Do **not** apply this migration to a linked remote Supabase project until the release-control ticket has a hosted backup/PITR restore point, reviewed dry-run report, preview validation, and Lucy's explicit approval for the exact production action.
- The #7 artifacts are additive. They create local migration-run/mapping tables and a read-only preview function; they do not rewrite or delete Learning Sessions, Session Questions, Assessment Attempts, events, snapshots, final results, or corrections.
- Docker/Podman/local Supabase runtime validation is still blocked in this workstream, so DB runtime apply/list/advisor evidence remains release debt for #11.

## Local dry-run paths

### TypeScript preview seam

The pure local preview seam is `previewLiveTestV2Migration` in [web/src/modules/catalog/live-test-v2-migration-preview.ts](../../web/src/modules/catalog/live-test-v2-migration-preview.ts). It accepts a local snapshot of:

- existing `live_test_resources`, `live_test_blocks`, and `live_test_items` rows;
- the one-time `Chunks-resource - CVR_new.csv` text;
- local snapshots of `learning_sessions`, `session_questions`, user identity rows, learner-token samples, and lifecycle table counts.

It returns deterministic counts, checksums, external-ref mappings, CCI profile seed categories, target CVR/CCI/CPD derivation, anomaly lists, legacy Clerk compatibility, signed-token assumptions, and rollback notes. The report explicitly sets `localOnly: true` and `remoteMutation: false`.

### SQL preview helper

The local migration [supabase/migrations/20260719041046_hosted_live_test_v2_migration_prep.sql](../../supabase/migrations/20260719041046_hosted_live_test_v2_migration_prep.sql) creates:

- `live_test_v2_migration_runs` — stores reviewed dry-run/apply reports and checksums;
- `live_test_v2_item_mappings` — additive legacy item/external-ref to V2 immutable item-ref mapping;
- `preview_live_test_v2_migration(source_filename)` — read-only report function.

Once local Supabase is available, run against a local restored/synthetic database only:

```bash
supabase migration list --local
supabase migration up --local
supabase test db --local
```

Then inspect the read-only report locally:

```sql
select public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv');
```

## Expected dry-run evidence

A release-ready report must show:

- row parity for legacy resources, blocks, items, V2 target packages, versions, sections, and items;
- 100 percent `session_questions.external_ref` resolution or a reviewed anomaly list;
- per-section `target_cvr_ohm` derived from CSV `Unit (Ohm)`;
- item `measured_cvr = TC × LC × TL` mismatch report;
- CCI category snapshot coverage for every migrated section;
- V1 CPD (`legacy CVR × legacy CCI`) versus V2 CPD (`target_cvr_ohm × CCI`) variance notes;
- legacy Clerk reference compatibility counts and Supabase Auth staff-link counts;
- learner token assumptions: hashed-only stored token values, expiry/revocation columns, and no learner Auth accounts;
- unchanged lifecycle row counts/checksums before and after dry-run.

## Rollback / restore readiness

Before any remote approval request:

1. Capture a hosted backup or PITR restore point and verify the restore path.
2. Export reviewed counts/checksums for all no-rewrite tables: `learning_sessions`, `session_questions`, `assessment_attempts`, `assessment_events`, `assessment_attempt_snapshots`, final-result/correction history where present.
3. Keep legacy `live_test_*` rows, legacy `session_questions.external_ref`, and legacy Clerk reference columns through the verification window.
4. Rollback before cutover means disabling V2 readers and removing only additive V2 package/mapping rows created by the recorded migration run.
5. If cutover has occurred, restore from the verified backup/PITR path rather than attempting ad hoc deletes in production.
