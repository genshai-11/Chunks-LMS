# Feature Specification: UI & Flow Improvements

**Feature Branch**: `feat/ui-flow-improvements` (child of `feat/standalone-learner-tests`)

**Created**: 2026-07-20

**Status**: Draft — intake open (bugs arrive incrementally from product owner)

**Input**: User description: "Create a child branch from the current branch to keep improving/editing UI & Flow issues. GitHub rule: commit CI only — never trigger CD on my own. Follow AGENTS.md release controls. Create a clear plan & tasks before executing; the owner will then send specific bugs to fix."

## Purpose

This feature is an **intake-driven fix cycle** for UI (presentation) and Flow (navigation/interaction) issues across the three role areas of Chunks-LMS: Admin, Teacher, Learner. It exists to receive concrete bug reports from the product owner, fix them under strict engineering constraints, and keep CI green — **without ever touching production deployment**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Teacher flow UI fixes (Priority: P1)

A teacher moves through the core measurement journey — learner tree → classes/programs → start session → observe → analysis, plus standalone tests — and hits UI/flow friction reported by the product owner (broken layout, confusing labels, wrong navigation, stuck states).

**Why this priority**: The teacher flow is the measurement core of the product (observe/finalize feeds all metrics). UI defects here directly block real classroom use.

**Independent Test**: Each reported teacher-flow bug is reproduced on the stated route, fixed, and re-verified on that route without touching any other flow.

**Acceptance Scenarios**:

1. **Given** a reported teacher-flow bug with repro steps, **When** the fix is applied, **Then** the reported behavior no longer occurs and the route passes lint/typecheck/test/build.
2. **Given** a fix in the observe/session flow, **When** it is reviewed, **Then** no scoring, probe, or finalization logic has been reimplemented in UI code (domain rules still come from domain modules only).

---

### User Story 2 - Learner portal UI fixes (Priority: P2)

A learner opens a scoped invite link (`/access?email=…`), picks a class when multi-enrolled, and views own attendance/analysis — and hits UI/flow friction reported by the product owner.

**Why this priority**: The learner portal is the V1 share-link surface; defects damage trust, but it is read-only so a defect cannot corrupt measurement data.

**Independent Test**: Each reported learner-portal bug is reproduced with the invite-link flow, fixed, and verified to still scope strictly to the matched email profile.

**Acceptance Scenarios**:

1. **Given** a reported learner-portal bug, **When** the fix is applied, **Then** the learner still sees only their own rows (`activeLearnerUserId` scoping unchanged).
2. **Given** any learner-portal change, **When** navigation is exercised, **Then** no staff-only route or data becomes reachable from the portal.

---

### User Story 3 - Admin console UI fixes (Priority: P3)

An admin manages accounts (active/inactive, invites) and the metrics catalog, views analysis/ops/audit — and hits UI/flow friction reported by the product owner.

**Why this priority**: Admin is a provisioning surface used less frequently than daily teaching; defects are annoying but rarely block a live class.

**Independent Test**: Each reported admin bug is reproduced on the stated admin route, fixed, and verified against that route only.

**Acceptance Scenarios**:

1. **Given** a reported admin-console bug, **When** the fix is applied, **Then** account/metrics behavior is unchanged (only presentation/flow is corrected).
2. **Given** any admin UI change, **When** authorization is exercised, **Then** `StaffGate role="admin"` gating is intact.


---

### Edge Cases

- Empty states (no learners/classes/sessions/resources) must render deliberate placeholders, not crashes or blank screens.
- Inactive teacher/learner accounts must show correct read-only/blocked behavior, not broken navigation.
- Multi-enrollment learners must keep the class picker step; single-enrollment learners skip it.
- `VITE_AUTH_BYPASS` CI mode must keep working (auth shell degrades gracefully).
- Unknown routes redirect to `/`; deep links to gated routes bounce to the correct sign-in, never a white screen.
- Slow/failed Supabase calls must surface an error state, not an infinite spinner.

## Requirements *(mandatory)*

### Functional Requirements

> This feature is presentation-only. It introduces NO data-model, migration, RLS, RPC, or domain-rule changes. Any bug whose fix would require one is escalated to a new spec instead of being fixed here.

- **FR-001**: Every reported issue MUST be logged (route, role area, repro steps, expected vs actual, severity) in `tasks.md` before a fix begins.
- **FR-002**: Fixes MUST be confined to the presentation layer (`web/src/pages/`, `web/src/components/`, `web/src/hooks/`, `web/src/state/`, `web/src/index.css`). Domain logic in `web/src/modules/` MUST NOT be reimplemented or bypassed in UI callers.
- **FR-003**: UI copy MUST use CONTEXT.md vocabulary — Learner/Teacher/Class/Course (program), Session Question, Probe Event, Final Result, Correction; probe counters labeled **n count / n depth / n depth max / n depth avg** (never "n" for finalized sample size; `maxProbeCount` ceiling is not "n depth max"); session kinds `regular | pretest | posttest`.
- **FR-004**: Learner portal MUST remain read-only and scoped to the matched email profile (`activeLearnerUserId`); no other learner's rows may be exposed.
- **FR-005**: Staff routes MUST remain behind `StaffGate` (native Supabase Auth + database `staff_roles`); UI fixes MUST NOT alter authorization behavior.
- **FR-006**: Every fix MUST pass CI parity locally: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` (in `web/`), plus `npx @fission-ai/openspec validate --all` when OpenSpec artifacts are touched.
- **FR-007**: Commits stay on `feat/ui-flow-improvements`. MUST NOT push to `main`/`master`, MUST NOT trigger Vercel production deploy, Supabase migration, or any CD without an explicit yes/no confirmation in the current turn. "Continue" is not deploy approval.
- **FR-008**: Any route addition/rename/removal MUST update `contracts/ui-routes.md` in the same commit.
- **FR-009**: Immutable assessment/probe/finalization/correction history MUST remain untouched — UI fixes never introduce data mutation or deletion behavior.
- **FR-010**: Before any `git push`, the deployment impact MUST be stated: feature-branch push = no CI/CD trigger; PR open = CI + Vercel preview; main/master push = CI + production deploy (forbidden without approval).

### Key Entities

- **Bug Report (intake item)**: route, role area, repro steps, expected vs actual behavior, severity, status, resolution commit. Lives in `tasks.md` — not a database entity.
- **UI Route Contract**: the declared map of routes → role gates in `contracts/ui-routes.md`, derived from `web/src/App.tsx`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of reported bugs have repro, expected/actual, and resolution recorded in `tasks.md`.
- **SC-002**: Every fix commit passes lint + typecheck + unit tests + build locally (CI parity) — 0 red checks at push time.
- **SC-003**: CI is green on any PR opened from this branch before merge is requested.
- **SC-004**: 0 production-impacting actions (main/master push, production deploy, remote migration) executed without a documented explicit approval.
- **SC-005**: Manual smoke of the three role flows (per `quickstart.md`) shows no regressions after each fix batch.

## Assumptions

- Bugs arrive incrementally from the product owner (Lucy); severity/priority is assigned at intake, defaulting to the owning story's priority.
- Base branch `feat/standalone-learner-tests` may keep evolving; this child branch rebases/merges from it when needed.
- All fixes target the React SPA in `web/`; no backend/Edge Function/Supabase schema work is in scope.
- Local validation uses `VITE_AUTH_BYPASS=true` where a real Supabase session is unavailable, matching CI build behavior.
