# Implementation Plan: Standalone Learner Tests

**Branch**: `feat/standalone-learner-tests` | **Date**: 2026-07-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-standalone-learner-tests/spec.md`

## Summary

Replace obsolete test/resource data with the canonical Chunks workbook, preserving a guarded destructive audit and correct session CVR + named CCI Ampe snapshots. Reconcile the hosted V2 package/generation schema into this bugfix-based branch, harden its security, and add a separate one-learner test aggregate, Admin resource/audio management, isolated Teacher runtime, and learner-profile Test Results tab. Existing live class sessions and Analysis remain unchanged.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19, Node.js 20+, SQL/PLpgSQL on PostgreSQL 17.6, Deno 2.1-compatible Edge runtime

**Primary Dependencies**: Vite 8, React Router 7, Supabase JS 2.110, Zod 4, Vitest 4, Playwright 1.61, pinned workbook parser, Supabase CLI 2.109

**Storage**: Supabase/Postgres public tables with RLS; private Supabase Storage bucket for narration; deterministic JSON import manifests outside runtime state

**Testing**: Vitest unit/component/integration tests, SQL database/RLS tests, Supabase advisors/lint, optional Playwright smoke

**Target Platform**: Responsive web application, hosted Supabase, Vercel preview/production

**Project Type**: React/TypeScript modular monolith with Postgres and one Edge Function

**Performance Goals**: Resource lookup under 30 seconds of user interaction; setup under two minutes; completed results visible within five seconds of refresh

**Constraints**: Exactly one learner per standalone run; no Class/Enrollment/Learning Session dependency; eight sessions/80 canonical items initially; immutable published/history rows; dry-run and final confirmation before remote deletion; approved current audio required to start

**Scale/Scope**: One canonical package for initial canary, eight sessions × ten items, current organization/learner scale, extensible versioned package catalog

## Constitution Check

*GATE: Passed before Phase 0 research; re-checked after Phase 1 design.*

- [x] Measurement and correction history remains immutable, except the explicitly scoped obsolete test reset with impact counts and final approval.
- [x] Standalone tests use separate routes/state/tables and do not extend Class-based Learning Sessions.
- [x] RLS, privileged grants, actor checks, private helpers, and hardened `search_path` are designed and testable.
- [x] Import/reset is deterministic, dry-run-first, idempotent/replay-safe, and begins with remote migration reconciliation.
- [x] Tests cover importer anomalies, domain transitions, RLS/RPC contracts, count drift, and rollback-sensitive behavior.
- [x] Preview/canary, database/Storage/Edge restore, commit/tag, and post-deploy gates are documented.

## Project Structure

### Documentation (this feature)

```text
specs/001-standalone-learner-tests/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database-rpcs.md
│   ├── edge-generation.md
│   └── import-manifest.schema.json
└── tasks.md
```

### Source Code (repository root)

```text
scripts/
├── import-standalone-test-workbook.mjs
└── lib/standalone-test-import/

supabase/
├── migrations/                 # reconciled hosted history + new security/catalog/run migrations
├── functions/live-test-generation/
├── seeds/
└── tests/

web/src/
├── components/test-resources/
├── components/standalone-tests/
├── lib/test-packages.ts
├── lib/standalone-tests.ts
├── modules/catalog/
├── modules/standalone-tests/
├── modules/reporting/standalone-test-results.ts
├── pages/admin/AdminResourcesPage.tsx
└── pages/teacher/
    ├── TeacherTestsPage.tsx
    ├── TeacherTestSetupPage.tsx
    ├── TeacherTestRunPage.tsx
    └── TeacherLearnerProfilePage.tsx

openspec/changes/add-standalone-learner-tests/
```

**Structure Decision**: Extend the existing modular monolith. Keep package/import code in catalog modules, standalone execution in a new domain module, and only reuse low-level measurement semantics. No new application/service repository is introduced.

## Phase 0: Research Results

See [research.md](research.md). All technical unknowns are resolved. The hosted migration gap, destructive dependency scope, workbook mapping, Edge version, Storage absence, and security advisor findings are recorded.

## Phase 1: Design

- [data-model.md](data-model.md) defines the catalog reuse, import audit, guarded reset graph, standalone aggregate, and state transitions.
- [contracts/database-rpcs.md](contracts/database-rpcs.md) defines preview/apply, runtime transition, and reporting RPCs.
- [contracts/edge-generation.md](contracts/edge-generation.md) defines stable 9Router narration/approval behavior.
- [contracts/import-manifest.schema.json](contracts/import-manifest.schema.json) defines deterministic import output.
- [quickstart.md](quickstart.md) defines local and approval-gated canary validation.

### Migration slices

1. Reconcile the seven already-applied hosted migrations and deployed Edge source.
2. Security correction: RLS predicate, private helpers, EXECUTE grants, actor checks, search paths.
3. Import/reset audit and guarded canonical replacement logic.
4. Standalone assignment/run/result tables, indexes, RLS, transition/report RPCs.
5. Private narration bucket/policies in an approval-gated migration or setup step.

### Application slices

1. Deterministic workbook importer + fixtures.
2. Catalog/resource data access and split Admin resource workspace.
3. Narration generation/review/readiness.
4. Standalone Teacher assignment/setup/runtime.
5. Learner profile Test Results tab.

### OpenSpec compatibility

Create `openspec/changes/add-standalone-learner-tests` from this Spec Kit feature and keep requirement IDs cross-referenced. OpenSpec remains a CI compatibility artifact; this Spec Kit directory is the active implementation source.

### Post-design Constitution Check

All gates remain passed. The complexity of separate event/snapshot tables is justified because reusing Class-bound attempts would violate the explicit module boundary and no-Class requirement.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Separate standalone attempt/event/snapshot tables | Preserve 1-to-1 no-Class aggregate while retaining immutable result/probe/correction semantics | Reusing current assessment tables requires a Learning Session/Class or a risky global generalization |
| Spec Kit plus OpenSpec cross-link | User required Spec Kit while repository CI/project rules require OpenSpec | Removing either workflow would violate an explicit workflow requirement |

## Delivery and release controls

- Commit each slice before any deployment.
- Run full CI plus available SQL/RLS checks.
- Stop before remote reset and show exact counts + SQL for final confirmation.
- Tag release candidate before remote database/Storage/Edge changes.
- Use one learner/one session canary before preview/production.
- Preserve downloaded Edge v2 source and database backups for rollback.
- Do not push production-triggering branches or deploy without explicit approval.
