## 1. Product Confirmation and Spec Tracking

- [x] 1.1 Confirm official domain change from 4 colors to 7-color spectrum
- [x] 1.2 Create dedicated tracking change `update-7-colors` and ignore auth cutover tasks for this purpose
- [ ] 1.3 Resolve open domain questions before changing persistence or metric semantics

## 2. CodeGraph Impact Mapping

- [x] 2.1 Use CodeGraph to locate capture dock UI, keyboard handlers, probe flow, heatmap, metrics, CPD matrix, and API write/refetch paths
- [x] 2.2 Record affected files and choose the smallest safe implementation slices

### Impact Map

CodeGraph status: initialized and up to date. Runtime limitation: AGENTS.md requires `codegraph-advisor`, but that skill is not available in this OpenCode runtime; CodeGraph CLI was used directly.

Primary domain and tests:

- `web/src/modules/result-lifecycle/types.ts`
- `web/src/modules/result-lifecycle/state-machine.ts`
- `web/src/modules/result-lifecycle/state-machine.test.ts`
- `web/src/modules/assessment/session-capture.ts`
- `web/src/modules/assessment/session-capture.test.ts`
- `web/src/modules/assessment/probe-actions.ts`
- `web/src/modules/assessment/probe-actions.test.ts`
- `web/src/modules/metrics/calculate.ts`
- `web/src/modules/metrics/calculate.test.ts`

Primary UI/reporting:

- `web/src/pages/teacher/TeacherObservePage.tsx`
- `web/src/pages/teacher/TeacherTestRunPage.tsx`
- `web/src/pages/teacher/TeacherTestAnalysisPage.tsx`
- `web/src/components/ObserveHeatmap.tsx`
- `web/src/components/AnalysisChartsPanel.tsx`
- `web/src/components/ProgressAnalysisView.tsx`
- `web/src/modules/teacher/learner-insights.ts`
- `web/src/modules/teacher/learner-insights.test.ts`

Sync/API boundaries:

- `web/src/lib/live-assessment.ts`
- `web/src/lib/standalone-tests.ts`
- `web/src/lib/supabase-sync.ts`
- `web/src/types/database.ts`

Database impact candidates:

- `supabase/migrations/20260711000000_foundation.sql`
- `supabase/migrations/20260711130000_live_assessment_capture.sql`
- `supabase/migrations/20260719154857_standalone_test_runtime_rpcs.sql`
- `supabase/migrations/20260722113400_remove_standalone_probe_ceiling.sql`
- `supabase/migrations/20260719154859_standalone_test_reporting_rpc.sql`
- new additive migration likely required for `public.result_color` enum values `orange`, `blue`, `indigo` and RPC/reporting semantics

## 3. Regression Tests First

- [ ] 3.1 Add capture UI tests for primary dock labels and shortcuts `0/1/2/3`
- [x] 3.2 Add probe domain/action tests for `F/1`, `C/2`, `D/3/Enter` and Green-to-probe transition
- [x] 3.3 Add lifecycle tests for effective colors Yellow and Indigo after probe resolution
- [ ] 3.4 Add component heatmap tests for effective color and `+n` probe badge
- [x] 3.5 Add metric tests for `N_total`, warm/cool RFC, and RAC/%c
- [x] 3.6 Add CPD scale tests for 7 normalized factors
- [x] 3.7 Add performance regression coverage or document why no reliable seam exists

Performance seam note: standalone runtime now updates the active item snapshot optimistically after record/probe RPC responses and no longer clears request cache/refetches the full run on each scoring click. No component-level performance harness exists yet.

## 4. Implementation

- [x] 4.1 Update domain color vocabulary/types/constants to the 7-color spectrum
- [x] 4.2 Update primary capture dock labels, colors, and keyboard shortcuts
- [x] 4.3 Update Green probe dock labels, actions, and keyboard shortcuts
- [x] 4.4 Persist and read effective spectrum color without losing immutable probe history
- [x] 4.5 Update heatmap rendering and probe depth badge
- [x] 4.6 Update `N_total`, RFC, RAC/%c, and sample labeling
- [x] 4.7 Update CPD matrix scale and Admin dynamic configuration if applicable
- [x] 4.8 Replace full-session refetch-on-click with optimistic active-cell updates where safe

## 5. Documentation and Migration Review

- [x] 5.1 Update `CONTEXT.md` product language for 7-color spectrum
- [x] 5.2 Update relevant ADR/spec docs for result lifecycle and metrics
- [x] 5.3 Identify whether Supabase migrations or data backfill are required
- [x] 5.4 If migration is required, prepare local-only migration and do not apply remote without explicit approval

Supabase status: CLI is available through `npx.cmd supabase` v2.114.0, but the installed PATH command is absent. The default CLI profile at `C:\Users\gensh\.supabase\profile` fails with `LegacyProfileLoadError`; local commands were run with a temp `USERPROFILE`. Local migration apply is blocked because Docker/Podman is not installed or not in PATH and local Postgres `127.0.0.1:54322` is not running. Remote migration apply was not attempted because it is production-impacting and requires explicit approval plus working auth/link.

Remote apply update: Lucy approved applying all five migrations listed by dry-run. `supabase db push --linked --include-all` applied `20260723074000`, `20260723144800`, `20260803143000`, `20260815014013`, and `20260815014027` to project `ekubetkxfcuxlyahesrl`. Verification SQL confirms all five versions in `supabase_migrations.schema_migrations`, 7 `result_color` enum values, numeric `effective_score` columns, 0.00..1.00 `color_factor` outputs, score check constraints, and `narration_variants_package_lifecycle_idx`.

Final verification update: OpenSpec strict validation passes. Web `typecheck`, `build`, `lint`, and full `test` pass after stabilizing `AuthProvider.test.tsx` to avoid a full-suite-only timeout. Lint still reports the existing 3 warnings: Fast Refresh exports in `StaffSessionContext.tsx` and `main.tsx`, plus the existing unnecessary `exitPath` hook dependency in `TeacherObservePage.tsx`.

## 6. Verification

- [x] 6.1 Run targeted tests for changed areas
- [x] 6.2 Run `npm run lint`
- [x] 6.3 Run `npm run typecheck`
- [x] 6.4 Run `npm run test`
- [x] 6.5 Run `npm run build`
- [x] 6.6 Report any unavailable Supabase/Vercel CLI checks as blockers or gaps

Verification notes:

- `npx.cmd -y @fission-ai/openspec validate update-7-colors --strict --no-interactive` passes.
- `npm.cmd --prefix web run typecheck` passes.
- `npm.cmd --prefix web run test` passes: 40 files, 162 tests.
- `npm.cmd --prefix web run build` passes with existing bundle-size/dynamic-import warnings.
- `npm.cmd --prefix web run lint` has 0 errors and 3 warnings in existing files (`StaffSessionContext.tsx`, `main.tsx`, `TeacherObservePage.tsx` dependency warning).
- `npx.cmd supabase status` / `migration list --local` blocked by missing Docker/Podman/local DB.

## Acceptance Criteria

- Primary dock always shows `0 · Red`, `1 · Orange`, `2 · Green`, `3 · Purple`.
- Pressing/clicking Green immediately opens the probe dock.
- Probe dock shows `Yellow (Fail)`, `Blue (Continue)`, `Indigo (Done)` with required shortcuts.
- Heatmap displays final effective color and `+n` probe badge.
- Spectrum reporting uses `N_total = 49 + sum(probes)` for standard 49-question runs.
- RFC uses warm colors; RAC/%c uses cool colors.
- CPD factors follow the 0.00 to 1.00 7-color scale.
- Capture button response is optimistic and does not trigger a seven-session refetch per click.
