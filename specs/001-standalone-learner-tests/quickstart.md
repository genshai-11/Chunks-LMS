# Quickstart Validation — Standalone Learner Tests

## Prerequisites

- Work in `Chunks-LMS-standalone-test` on `feat/standalone-learner-tests`.
- Node 20+, npm, Supabase CLI 2.109+.
- The canonical workbook is available outside Git.
- For database integration tests, Docker Desktop/Supabase local stack must be running.
- Hosted commands require explicit approval after reviewed impact counts.

## 1. Verify branch and migration baseline

```powershell
git status --short --branch
supabase link --project-ref ekubetkxfcuxlyahesrl
supabase migration list
```

Expected: branch is clean and local migration history contains all hosted 2026-07-19 migrations before any new feature migration.

## 2. Validate the workbook without applying

Run the importer in dry-run mode against `Chunks Resource.xlsx` and write the manifest/report to a temporary ignored folder.

Expected:

- source hash `1022fd3d09fc17e8b07be3e48b67bb6bae5eaac01d2c1498d5933f258a3185d6`;
- one package;
- eight sessions and 80 items;
- CVR `3,5,7,9,11,13,15,17`;
- CCI Ampe `2,2,4,4,6,6,8,8` with workbook names;
- one warning for Session 1 / Item 10 CCI mismatch;
- zero structural errors.

## 3. Run local database validation

```powershell
supabase start
supabase db reset
supabase test db
```

Expected:

- migrations replay from empty database;
- reset/import tests prove test-only deletion guards;
- RLS/RPC tests deny anon, cross-org, and cross-learner access;
- canonical catalog contains one draft, eight sessions, 80 items.

If Docker remains unavailable, record the gap and do not use the hosted database as an unreviewed substitute.

## 4. Run application checks

```powershell
npm install
npm run openspec:validate
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: every command exits successfully.

## 5. Validate Admin resources locally

1. Open Resources.
2. Review import issues and all eight session measurements.
3. Verify correct CVR, CCI Name/Ampe, and CPD.
4. Confirm draft edits work and published mutations are blocked.
5. In mock generation mode, generate/review narration readiness.

## 6. Validate standalone Teacher flow locally

1. Select one active learner without selecting a Class.
2. Choose package/session, language, and voice.
3. Verify start is blocked with incomplete audio.
4. Prepare approved mock narration and start.
5. Complete ten items, including probe and correction paths.
6. Confirm no Class, Enrollment, or live Learning Session changed.

## 7. Validate Test Results

Open the learner profile’s Test Results tab.

Expected: package/version, session, CVR, CCI Name/Ampe, CPD, language, final totals, correction state, and item provenance appear; existing Analysis remains unchanged.

## 8. Remote canary — approval required

Before any remote apply, capture and review:

- exact delete counts by table;
- the one completed legacy test session and ten attempts;
- migration SQL;
- database backup/restore path;
- current Edge Function source/version;
- private narration bucket/storage rollback;
- CI results and commit/tag.

After explicit approval, run one learner + one session canary, verify restore paths, and stop for production approval.
