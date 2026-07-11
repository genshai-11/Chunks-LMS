## Why

Chunks-LMS needs a clean foundation for measuring learner Focus and Awareness without inheriting the content-library and single-response-per-round assumptions of Chunks Offline. Establishing the domain contracts, security model, assessment lifecycle, and reproducible metrics now prevents the first implementation from hardcoding behavior that must later support scheduling, multiple learners, corrections, and CCI/CVR inputs.

## What Changes

- Establish Clerk-authenticated Admin, Teacher, and Learner access enforced by Supabase Row Level Security.
- Introduce courses, one-teacher classes, configurable learner capacity, learner profiles, and enrollment lifecycle.
- Introduce scheduled and actual learning sessions with attendance tracking.
- Introduce resource-agnostic session questions and teacher-observed assessment capture in question-first and learner-first modes.
- Introduce the four-color result scale and Green probe lifecycle with immutable probe/finalization/correction history.
- Introduce immutable, versioned operational metric templates and dynamic report windows.
- Introduce teacher and learner progress reporting while excluding content authoring, arbitrary metric formulas, notifications, and CCI/CVR integration from V1.
- **BREAKING**: The project uses a new learner-question Assessment Attempt model rather than the Chunks Offline one-response-per-round model; old migrations and response APIs are not compatible.

## Capabilities

### New Capabilities

- `identity-access`: Clerk authentication, organization membership, role authorization, and learner/teacher/admin data isolation.
- `course-roster`: Courses, classes, one-teacher assignment, learner profiles, configurable class capacity, and enrollments.
- `session-scheduling`: Planned sessions, actual learning sessions, rescheduling/cancellation, and learner attendance.
- `assessment-capture`: Resource-agnostic ordered questions and teacher assessment capture in learner-first or question-first mode.
- `result-lifecycle`: Provisional colors, Green probe transitions, finalization, probe limits, and auditable corrections.
- `metric-templates`: Immutable versioned operational metric definitions and exact calculation/null semantics.
- `progress-reporting`: Teacher and learner dashboards with course-level and dynamic time-window comparisons.

### Modified Capabilities

None. This repository has no existing OpenSpec capabilities.

## Impact

- Creates the initial application, database, RLS, test, and deployment foundations for the new `genshai-11/Chunks-LMS` repository.
- Adds Clerk and Supabase as foundational external systems.
- Establishes Postgres transactional tables, immutable assessment events, current snapshots, and report projections.
- Requires responsive teacher/admin/learner application surfaces.
- Does not migrate or modify `chunks-offline-v1`; reusable assets and reporting utilities may be extracted only after compatibility review.
