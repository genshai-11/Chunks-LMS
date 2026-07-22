# Tasks: UI & Flow Improvements

**Branch**: `feat/ui-flow-improvements` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Intake-driven: each bug report from the owner becomes one **Fix Group** below. No speculative fixes.

## Standing rules for every Fix Group

1. Log the bug first (FR-001): route, role area, repro steps, expected vs actual, severity.
2. Reproduce on the stated route before editing.
3. Fix in presentation layer only (`pages/`, `components/`, `hooks/`, `state/`, `index.css`) — never `modules/`, never `auth/` gating, never Supabase schema (FR-002/004/005).
4. UI copy follows CONTEXT.md vocabulary incl. n count / n depth / n depth max / n depth avg (FR-003).
5. Verify CI parity: `npm run lint && npm run typecheck && npm run test && npm run build` in `web/` (FR-006).
6. One concern per commit on `feat/ui-flow-improvements`; state deployment impact before any push; never push to `main`/`master` (FR-007/FR-010).
7. Route changes update `contracts/ui-routes.md` in the same commit (FR-008).
8. Bug needs data/domain change? Mark `escalated` with rationale — do not fix here (data-model.md).

---

## Phase 1 — Setup (DONE)

- [x] T001 Create child branch `feat/ui-flow-improvements` from `feat/standalone-learner-tests` @ 0288ee1
- [x] T002 Point `.specify/feature.json` at `specs/002-ui-flow-improvements`
- [x] T003 Scaffold spec artifacts: spec.md, plan.md, research.md, data-model.md, quickstart.md, contracts/ui-routes.md

## Phase 2 — Intake (WAITING FOR OWNER)

> Format per bug:
>
> ### Fix Group UI-### — <short title> (P1/P2/P3, severity: blocker/major/minor)
> - **Reported**: YYYY-MM-DD | **Route**: <path> | **Area**: Teacher/Learner/Admin/Shared
> - **Repro**: <steps> | **Expected**: <…> | **Actual**: <…>
> - [ ] Reproduce → [ ] Fix → [ ] CI parity green → [ ] Commit `<sha>` → [ ] Smoke per quickstart.md

### Fix Group UI-001 — Session page: remove Live Test button & Session label picker (P1, severity: major)

- **Reported**: 2026-07-20 | **Route**: `/teacher/session` | **Area**: Teacher
- **Repro**: Open Start session form → "Session format" panel shows a **Live Test** button; "Session label" panel shows Regular day / Pretest / Posttest.
- **Expected**: Session page only splits the class (lesson sessions) — no Live Test button (live tests live under `/teacher/tests` standalone module); no session label picker because the default is `regular`.
- **Actual**: Both pickers visible on the class-session start form.
- [x] Reproduce → confirmed panels at `TeacherSessionPage.tsx` (Session format / Live-test resource / Session label)
- [x] Fix → removed 3 panels + live-test state/effects/imports; `startLiveNow` now relies on domain defaults (`regular`/`lesson`); historical sessions still display their `sessionKind` badge
- [x] CI parity green → oxlint 0 errors · tsc -b exit 0 · vitest 142/142 pass · vite build (see commit)
- [x] Commit `<see git log>` → [ ] Smoke per quickstart.md (pending owner check on preview)

## Phase 3 — Batch close-out (per fix batch)

- [ ] T900 Manual smoke of the three role flows per `quickstart.md` (SC-005)
- [ ] T901 Report CI/CD impact to owner; push/PR only on request (FR-010)
