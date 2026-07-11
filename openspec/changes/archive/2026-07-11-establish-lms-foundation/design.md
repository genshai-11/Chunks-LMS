## Context

Chunks-LMS is a new measurement-focused LMS. It inherits selected UX and reporting lessons from Chunks Offline but cannot inherit its single-response-per-round schema. V1 serves Admin, Teacher, and Learner roles; a Class has one Teacher and normally up to three Learners; assessment is teacher-observed and content-independent.

The system must preserve Green probe and correction history, provide fast realtime session UX, reproduce metrics under versioned definitions, and use Clerk authentication with Supabase authorization.

## Goals / Non-Goals

**Goals:**

- Establish a testable modular monolith with explicit seams.
- Make Postgres the authoritative write model.
- Preserve immutable assessment lifecycle history while serving current snapshots efficiently.
- Enforce organization, class, and self-access through RLS.
- Support dynamic report windows using versioned metric templates.
- Keep future CCI/CVR integration possible without coupling V1 to resource content.

**Non-Goals:**

- Content authoring or resource-library ownership.
- Custom metric formula builder.
- Notifications, billing, or multiple teachers per class.
- CCI/CVR capture in V1.
- Migration of Chunks Offline production data.
- Psychometric validation or cross-class normative ranking.

## Decisions

### Postgres-centered hybrid modular monolith

Use one deployable TypeScript application with module-owned behavior and shared Supabase Postgres. Roster, scheduling, and configuration use ordinary transactional state. Assessment, probe, finalization, and correction append immutable events and update current snapshots in the same database transaction.

A pure transactional model was rejected because correction and probe history would be fragile. Full event sourcing was rejected because it adds projection and operational complexity beyond V1 needs.

### Module seams

Use deep behavioral interfaces for Identity and Access, Course and Roster, Scheduling and Attendance, Assessment Capture, Result Lifecycle, Metrics, and Reporting. UI callers must not reproduce finalization, probe-limit, correction, or denominator logic.

### Assessment identity

A Session Question has an immutable internal ID and a mutable visible sequence. An Assessment Attempt belongs to one Learning Session, Session Question, Learner, and observing Teacher. The effective uniqueness is learner plus question occurrence, not question alone.

### Result lifecycle

Red, Yellow, and Purple provisional results may finalize directly. Green opens a probe flow. Fail finalizes Yellow, Continue appends another probe while below the configured limit, and Done finalizes Green. At the maximum probe count, the Teacher must explicitly choose Fail or Done. Corrections append an event and update the effective snapshot without deleting original history.

### Metric definitions

Metric template versions are immutable and include population, filters, formula, window semantics, null behavior, minimum sample, display metadata, and interpretation direction. Only effective finalized results contribute. Empty denominators produce null, never zero.

### Identity and RLS

Use Clerk native Supabase third-party authentication. Clerk subject identifies the authenticated User; organization claims provide a coarse boundary. Postgres relationships remain authoritative for Teacher assignment, Enrollment, and Learner ownership. RLS protects tables, Storage, and Realtime; privileged workflows use narrowly scoped database functions.

### Realtime

Subscribe clients to current session/attempt snapshots rather than replaying raw events. Event rows remain available for audit and recomputation.

### CI/CD pipeline

Use GitHub Actions as the source of truth for quality gates and Vercel for application hosting.

| Stage | Trigger | Actions |
|---|---|---|
| **CI** | PR + push to `main` | install, lint, typecheck, unit tests, build, `openspec validate` |
| **Preview CD** | PR | Vercel preview deploy; optional Supabase branch/preview notes in docs |
| **Production CD** | push to `main` after CI green | Vercel production deploy; Supabase migrations applied via controlled workflow or manual promote |
| **DB migrations** | never auto-destructive | SQL migrations reviewed in PR; applied with Supabase CLI against staged then production |

Secrets stay in GitHub Actions / Vercel / Supabase project settings — never in the repo. Clerk and Supabase keys use environment validation at app boot.

## Risks / Trade-offs

- **Event and snapshot divergence** → append the event and update the snapshot in one transaction; add invariant tests and reconciliation tooling.
- **Metrics appear scientifically validated** → label them operational/experimental, show sample sizes, and prohibit normative claims in V1.
- **Complex RLS policies become difficult to audit** → centralize membership predicates, test each role, and deny by default.
- **Green rubric ambiguity** → require a documented teacher rubric before polishing capture UX.
- **Foundation change is broad** → implement vertical slices in task order and keep modules deployable together.
- **Recurring schedules grow scope** → support weekly recurrence and materialize occurrences explicitly in V1.

## Migration Plan

1. Scaffold the TypeScript application, test harness, Supabase local project, and environment validation.
2. Configure Clerk third-party auth and profile synchronization.
3. Apply foundational transactional schema and RLS.
4. Implement assessment events/snapshots and database-owned transitions.
5. Implement metrics and reporting read paths.
6. Add responsive role-specific UI vertical slices.
7. Validate locally with seeded organizations, classes, three learners, sessions, probes, and corrections.

Rollback before production consists of reverting migrations in the empty new project. No Chunks Offline database is modified.

## Open Questions

- Whether the first seeded course is `ERE-Level-A` or `ERE-Level-B`.
- Whether finalized-result corrections after session closure require Admin approval or only a Teacher reason.
- Minimum sample thresholds for experimental metrics.
- Exact written teacher rubric distinguishing Green, Purple, Continue, and Done.
