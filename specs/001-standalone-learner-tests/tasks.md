# Tasks: Standalone Learner Tests

**Input**: Design documents from `/specs/001-standalone-learner-tests/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required before domain, importer, RLS/RPC, migration, and destructive-guard implementation.

## Format: `[ID] [P?] [Story?] Description`

## Phase 1: Setup and Remote History Reconciliation

**Purpose**: Establish an accurate, reviewable branch baseline before feature migrations.

- [x] T001 Link only the new worktree to project `ekubetkxfcuxlyahesrl` and record the command/result in `docs/ops/standalone-test-rollout.md`
- [x] T002 Fetch/recover hosted migrations `20260719025253` through `20260719072000`, compare with `fix/supabase-auth-resource-recovery`, and commit reconciled files under `supabase/migrations/`
- [x] T003 Download deployed `live-test-generation` v2 into a temporary review folder, reconcile stable source into `supabase/functions/live-test-generation/`, and document its rollback hash in `docs/ops/standalone-test-rollout.md`
- [x] T004 [P] Add the canonical workbook to `chunks-resourcce/Chunks Resource.xlsx` and record SHA-256 `1022fd3d09fc17e8b07be3e48b67bb6bae5eaac01d2c1498d5933f258a3185d6` in `chunks-resourcce/README.md`
- [x] T005 [P] Install and pin the workbook parser dependency at the repository root and commit `package.json` plus lockfile

**Checkpoint**: Local branch accurately represents the hosted schema/function baseline and canonical source.

---

## Phase 2: Foundational Security and Standalone Schema

**Purpose**: Block all user stories until remote exposure and shared schema contracts are safe.

- [x] T006 [P] Add SQL regression tests for catalog staff-read predicate, anon RPC denial, explicit grants, and hardened search paths in `supabase/tests/test_catalog_security_test.sql`
- [x] T007 [P] Add SQL regression tests for same-organization Teacher access, cross-organization denial, learner self-only access, and one-open-run constraints in `supabase/tests/standalone_test_rls_test.sql`
- [x] T008 Create a migration via `supabase migration new harden_test_catalog_security` and implement the reviewed RLS/RPC security fixes in the generated `supabase/migrations/*_harden_test_catalog_security.sql`
- [x] T009 Create a migration via `supabase migration new standalone_test_schema` and add import audit plus standalone assignment/run/item/attempt/event/snapshot tables, indexes, explicit grants, and RLS in `supabase/migrations/*_standalone_test_schema.sql`
- [x] T010 [P] Add TypeScript catalog/standalone domain types and invariant tests in `web/src/modules/standalone-tests/types.ts` and `web/src/modules/standalone-tests/types.test.ts`
- [ ] T011 Implement typed Supabase row mapping/readiness helpers in `web/src/lib/standalone-tests.ts` and `web/src/lib/test-packages.ts`
- [x] T012 Run security advisors and record baseline/residual findings in `docs/ops/standalone-test-security-review.md`

**Checkpoint**: Security/schema foundation is testable and blocks unauthorized or Class-coupled behavior.

---

## Phase 3: User Story 1 — Replace Obsolete Test Data (Priority: P1) 🎯 MVP

**Goal**: Dry-run, impact-preview, and transactionally replace obsolete test-only data from the canonical workbook.

**Independent Test**: Preview reports one package/eight sessions/80 items, correct measurements, one mismatch warning, and exact delete counts; apply aborts on drift and preserves all non-test LMS rows.

### Tests for User Story 1

- [x] T013 [P] [US1] Add workbook fixture tests for valid 8×10 source, missing sheet, duplicate item, blank bilingual prompt, invalid join, and CCI mismatch in `scripts/lib/standalone-test-import/import.test.mjs`
- [x] T014 [P] [US1] Add JSON manifest schema/shape tests in `scripts/lib/standalone-test-import/manifest.test.mjs`
- [x] T015 [P] [US1] Add SQL tests for preview-only behavior, allowlisted dependency graph, count/token drift abort, transactional rollback, and excluded LMS tables in `supabase/tests/test_catalog_replacement_test.sql`

### Implementation for User Story 1

- [x] T016 [US1] Implement workbook parsing, normalization, SHA-256 provenance, exact count/order/join validation, and anomaly reporting in `scripts/lib/standalone-test-import/workbook.mjs`
- [x] T017 [US1] Implement deterministic manifest generation matching `specs/001-standalone-learner-tests/contracts/import-manifest.schema.json` in `scripts/lib/standalone-test-import/manifest.mjs`
- [x] T018 [US1] Implement the dry-run-first CLI and JSON/SQL output in `scripts/import-standalone-test-workbook.mjs`
- [x] T019 [US1] Create a migration via `supabase migration new guarded_test_catalog_replacement` and implement import-run audit, preview token/count checks, allowlisted test-only deletion, and canonical draft insert in `supabase/migrations/*_guarded_test_catalog_replacement.sql`
- [x] T020 [US1] Generate and review canonical manifest/seed outputs in `supabase/seeds/standalone-test-canonical.generated.json` and `supabase/seeds/standalone-test-canonical.generated.sql`
- [x] T021 [US1] Add the exact remote impact query, backup scope, restore path, and final confirmation template to `docs/ops/standalone-test-rollout.md`

**Checkpoint**: Canonical replacement is locally reproducible and remote deletion remains blocked at final approval.

---

## Phase 4: User Story 2 — Manage Canonical Test Resources (Priority: P2)

**Goal**: Admin can review/manage draft packages, sessions, CCI, items/CVR, issues, publication, and readiness.

**Independent Test**: All eight sessions display correct CVR, CCI Name/Ampe, CPD, ten bilingual items, immutable publication rules, and import warnings.

### Tests for User Story 2

- [ ] T022 [P] [US2] Add catalog immutability, section measurement, and CPD tests in `web/src/modules/catalog/test-package-catalog.test.ts`
- [ ] T023 [P] [US2] Add Resource workspace load/filter/edit/publish/error component tests in `web/src/pages/admin/AdminResourcesPage.test.tsx`

### Implementation for User Story 2

- [ ] T024 [US2] Selectively port/refine V2 catalog domain logic into `web/src/modules/catalog/test-package-catalog.ts`
- [ ] T025 [US2] Implement draft CRUD, publish/archive, snapshot override, import preview, and readiness data access in `web/src/lib/test-packages.ts`
- [ ] T026 [P] [US2] Build package/session filter and summary components in `web/src/components/test-resources/ResourceScopeFilters.tsx` and `web/src/components/test-resources/ResourceSummaryCards.tsx`
- [ ] T027 [P] [US2] Build focused package/session, CCI, item/CVR, and import-issues panels under `web/src/components/test-resources/`
- [ ] T028 [US2] Assemble `/admin/resources` in `web/src/pages/admin/AdminResourcesPage.tsx`, `web/src/pages/admin/AdminLayout.tsx`, and `web/src/App.tsx`

**Checkpoint**: Admin can fully review the canonical draft and cannot mutate published history.

---

## Phase 5: User Story 3 — Prepare and Approve Test Audio (Priority: P3)

**Goal**: Generate/review/approve private VI/EN intro and item narration and expose per-language/voice readiness.

**Independent Test**: One session becomes ready only after one current approved intro and ten current approved item variants in the selected language/voice.

### Tests for User Story 3

- [ ] T029 [P] [US3] Add Edge adapter/request/auth/redaction/retry tests in `supabase/functions/live-test-generation/index.test.ts` and `supabase/functions/live-test-generation/adapters.test.ts`
- [ ] T030 [P] [US3] Add narration source-hash, approval, stale-audio, and readiness tests in `web/src/modules/catalog/narration-readiness.test.ts`
- [ ] T031 [P] [US3] Add private bucket and Storage policy tests in `supabase/tests/narration_storage_test.sql`

### Implementation for User Story 3

- [ ] T032 [US3] Reconcile and harden stable Edge actions without adding `generateCVRPreview` in `supabase/functions/live-test-generation/index.ts` and `supabase/functions/live-test-generation/adapters.ts`
- [ ] T033 [US3] Create a migration via `supabase migration new narration_storage_policies` and add private narration bucket/policies in `supabase/migrations/*_narration_storage_policies.sql`
- [ ] T034 [US3] Implement generation/approval client and readiness calculation in `web/src/modules/catalog/live-test-generation.ts` and `web/src/modules/catalog/narration-readiness.ts`
- [ ] T035 [US3] Build audio generation, playback review, approval/reject, and readiness panels in `web/src/components/test-resources/AudioReadinessPanel.tsx`
- [ ] T036 [US3] Integrate audio review into `web/src/pages/admin/AdminResourcesPage.tsx`

**Checkpoint**: Audio is private, audited, review-gated, and runtime readiness is deterministic.

---

## Phase 6: User Story 4 — Run a Standalone One-to-One Test (Priority: P4)

**Goal**: Teacher assigns one learner, configures one section, and completes an isolated ten-item run.

**Independent Test**: A learner with no Class completes a bilingual/audio-ready run; no Class, Enrollment, live Learning Session, or live capture state changes.

### Tests for User Story 4

- [ ] T037 [P] [US4] Add assignment/run state, one-learner, readiness token, frozen item, resume, and completion tests in `web/src/modules/standalone-tests/run.test.ts`
- [ ] T038 [P] [US4] Add standalone provisional/probe/finalization/correction tests in `web/src/modules/standalone-tests/result-lifecycle.test.ts`
- [ ] T039 [P] [US4] Add SQL contract tests for standalone transition RPCs and atomic event/snapshot updates in `supabase/tests/standalone_test_lifecycle_test.sql`
- [ ] T040 [P] [US4] Add setup and runner component tests in `web/src/pages/teacher/TeacherTestsPage.test.tsx` and `web/src/pages/teacher/TeacherTestRunPage.test.tsx`

### Implementation for User Story 4

- [ ] T041 [US4] Create a migration via `supabase migration new standalone_test_runtime_rpcs` and implement assignment/setup/start/result/probe/correction/complete RPCs in `supabase/migrations/*_standalone_test_runtime_rpcs.sql`
- [ ] T042 [US4] Implement standalone run domain orchestration in `web/src/modules/standalone-tests/run.ts` and `web/src/modules/standalone-tests/result-lifecycle.ts`
- [ ] T043 [US4] Implement typed standalone assignment/run/RPC access in `web/src/lib/standalone-tests.ts`
- [ ] T044 [P] [US4] Build assignment/progress dashboard in `web/src/pages/teacher/TeacherTestsPage.tsx`
- [ ] T045 [P] [US4] Build section setup with learner/language/voice/audio readiness in `web/src/pages/teacher/TeacherTestSetupPage.tsx`
- [ ] T046 [US4] Build isolated ten-item audio/prompt/result runner in `web/src/pages/teacher/TeacherTestRunPage.tsx`
- [ ] T047 [US4] Add standalone routes/navigation in `web/src/App.tsx` and `web/src/pages/teacher/TeacherLayout.tsx`

**Checkpoint**: Standalone run works without touching live sessions.

---

## Phase 7: User Story 5 — View Separate Test Results (Priority: P5)

**Goal**: Learner profile has a dedicated Test Results tab with correction-aware CPD provenance.

**Independent Test**: One completed run appears with package/session/measurement/result detail; empty state works; existing Analysis is unchanged.

### Tests for User Story 5

- [ ] T048 [P] [US5] Add reporting calculation/provenance/correction tests in `web/src/modules/reporting/standalone-test-results.test.ts`
- [ ] T049 [P] [US5] Add Test Results tab loading/empty/detail/error tests in `web/src/pages/teacher/TeacherLearnerTestResultsPage.test.tsx`
- [ ] T050 [P] [US5] Add SQL authorization/report contract tests in `supabase/tests/standalone_test_reporting_test.sql`

### Implementation for User Story 5

- [ ] T051 [US5] Create a migration via `supabase migration new standalone_test_reporting_rpc` and implement authorized finalized/corrected result reporting in `supabase/migrations/*_standalone_test_reporting_rpc.sql`
- [ ] T052 [US5] Implement correction-aware CPD records/summaries in `web/src/modules/reporting/standalone-test-results.ts`
- [ ] T053 [US5] Build the separate results surface in `web/src/pages/teacher/TeacherLearnerTestResultsPage.tsx`
- [ ] T054 [US5] Add profile tabs/nested Test Results route without changing Analysis in `web/src/pages/teacher/TeacherLearnerProfilePage.tsx` and `web/src/App.tsx`

**Checkpoint**: Standalone results are isolated, reproducible, and visible from learner profile.

---

## Phase 8: Polish, Validation, and Release Controls

- [ ] T055 [P] Update `CONTEXT.md`, `UBIQUITOUS_LANGUAGE.md`, and add/adjust ADRs under `docs/adr/` for standalone Test Assignment/Run boundaries
- [ ] T056 [P] Complete OpenSpec tasks and cross-links in `openspec/changes/add-standalone-learner-tests/`
- [ ] T057 Run `npm run openspec:validate`, lint, typecheck, unit tests, and build; record results in `docs/ops/standalone-test-rollout.md`
- [ ] T058 Run local Supabase reset/SQL tests/advisors when Docker is available; otherwise record the exact blocked checks in `docs/ops/standalone-test-rollout.md`
- [ ] T059 Execute the `quickstart.md` local validation and verify existing live-session/Analysis regression paths
- [ ] T060 Prepare clean release-candidate commits/tag, preview/canary checklist, database backup/restore, Edge rollback, Storage rollback, and post-deploy checks in `docs/ops/standalone-test-rollout.md`
- [ ] T061 Stop and present exact remote deletion counts plus migration SQL for Lucy’s final destructive confirmation before any `db push`, Storage creation, Edge deploy, or production deploy

---

## Dependencies & Execution Order

- Phase 1 blocks all feature migrations.
- Phase 2 blocks every user story.
- US1 is the MVP and blocks canonical-data-dependent US2–US5.
- US2 blocks publication/readiness for US3 and runtime selection for US4.
- US3 blocks non-mock runtime start in US4.
- US4 blocks populated-result validation in US5.
- Documentation/test tasks marked `[P]` may run concurrently when they touch different files.

## Parallel Opportunities

- T004/T005; T006/T007/T010; T013/T014/T015; T022/T023; T026/T027; T029/T030/T031; T037/T038/T039/T040; T048/T049/T050; T055/T056.

## Implementation Strategy

1. Complete Setup + Security/Schema foundation.
2. Deliver US1 as the independently testable MVP: canonical dry-run and guarded replacement.
3. Add Admin resource review (US2), then audio (US3).
4. Add standalone runtime (US4), then Test Results (US5).
5. Complete CI and local DB validation.
6. Stop at T061; remote destructive execution requires separate final approval.

## Format Validation

All 61 tasks use checkbox + sequential ID; user-story tasks include `[USn]`; parallelizable tasks include `[P]`; each implementation/test task names its target path.
