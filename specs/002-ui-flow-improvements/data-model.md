# Phase 1 Data Model: UI & Flow Improvements

**Verdict: N/A — this feature introduces no data-model changes.**

## Rationale

UI & Flow fixes are presentation-layer only (see `research.md` D3). They must not add, rename, or mutate any table, column, RLS policy, RPC, or domain aggregate.

## Entities referenced (read-only, unchanged)

UI fixes will render existing domain concepts whose definitions live in `CONTEXT.md` and `specs/001-standalone-learner-tests/data-model.md`:

- **User / Staff Roles** — staff gating (`auth_user_id` → `staff_roles`) and learner profiles (email-scoped invite).
- **Course / Class / Enrollment / Scheduled Session / Learning Session** — teacher tree and session flow labels.
- **Session Question / Assessment Attempt / Provisional Result / Probe Event / Final Result / Correction** — observe flow rendering; immutable history untouched (FR-009).
- **Metric Template / Metric Version / Metric Observation / Report Window** — analysis rendering with `n count / n depth / n depth max / n depth avg` product labels.
- **Test Resource / Test Block / Test Item / Standalone Test Assignment / Standalone Test Run** — teacher standalone-tests screens (from feature 001).

## Escalation rule

If a reported bug's correct fix requires a data or domain change (migration, RLS, RPC, scoring/probe/metrics rule), the fix is **not** made under this feature. It is recorded in `tasks.md` as `escalated` with a rationale, and a separate spec/change is proposed to the owner.
