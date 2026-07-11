## 1. Application and test foundation

- [x] 1.1 Scaffold the React and TypeScript application with responsive routing for Admin, Teacher, and Learner surfaces
- [x] 1.2 Configure formatting, linting, strict type checking, unit tests, and browser-level integration tests
- [x] 1.3 Initialize the local Supabase project, migration workflow, generated database types, and environment validation
- [x] 1.4 Add CI checks for install, lint, typecheck, tests, build, and OpenSpec validation
- [x] 1.5 Create deterministic local seed data for one Organization, one Course, one Teacher, one Class, and three Learners
- [x] 1.6 Add CD workflow for PR preview deploys and production deploy on main after CI green
- [x] 1.7 Document required CI/CD secrets, environments, and Supabase migration promotion steps

## 2. Identity and access

- [x] 2.1 Integrate Clerk authentication and protected role-aware application routes
- [x] 2.2 Configure Clerk as a native Supabase third-party auth provider for local and hosted environments
- [x] 2.3 Implement idempotent Clerk webhook synchronization into domain User profiles
- [x] 2.4 Add organization membership and Admin, Teacher, and Learner role persistence
- [x] 2.5 Implement and test deny-by-default RLS helpers for organization and self-access
- [x] 2.6 Add RLS integration tests proving cross-organization and cross-learner isolation

## 3. Course and roster

- [x] 3.1 Add Course, Class, Teacher assignment, Learner profile, and Enrollment migrations with constraints
- [x] 3.2 Enforce exactly one active Teacher and configurable positive capacity per active Class
- [x] 3.3 Implement Admin course, class, teacher, learner, and enrollment workflows
- [x] 3.4 Add lifecycle tests for class capacity, ended enrollments, and preserved history

## 4. Scheduling and attendance

- [x] 4.1 Add schedule definition, Scheduled Session, Learning Session, and Attendance migrations
- [x] 4.2 Implement one-time and weekly recurrence materialization with timezone handling
- [x] 4.3 Implement reschedule and cancellation lineage without deleting original occurrences
- [x] 4.4 Implement Teacher calendar, session start/completion, and attendance capture
- [x] 4.5 Add tests for duplicate starts, completed attendance, cancellation, and rescheduling

## 5. Assessment capture

- [x] 5.1 Add Session Question and Assessment Attempt schema with learner-question uniqueness
- [x] 5.2 Implement question creation with immutable identity, visible sequence, optional planned count, and optional external reference
- [x] 5.3 Implement question-first assessment capture for up to the configured Class capacity
- [x] 5.4 Implement learner-first capture over the same Assessment Attempts
- [x] 5.5 Preserve navigation position when switching capture modes
- [x] 5.6 Add tests for multiple Learners on one question and capture rejection after session completion

## 6. Result lifecycle and audit

- [x] 6.1 Add immutable assessment lifecycle event and current attempt snapshot migrations
- [x] 6.2 Implement database-owned direct finalization for Red, Yellow, and Purple
- [x] 6.3 Implement Green Fail, Continue, and Done transitions with configurable maximum probe count
- [x] 6.4 Require explicit Fail or Done when the maximum probe count is reached
- [x] 6.5 Implement atomic event append and current snapshot update functions
- [x] 6.6 Implement reasoned Correction events and effective-result snapshot updates
- [x] 6.7 Add state-machine, concurrency, rollback, and audit-history tests

## 7. Metric templates

- [x] 7.1 Add immutable Metric Template and Metric Version schema with display and validity metadata
- [x] 7.2 Seed versioned RFC, RAC, Average Performance, and Purple Mastery Rate templates
- [x] 7.3 Seed versioned Clarification Rate, Clarification Depth, Awareness Recovery, and Focus Stability templates
- [x] 7.4 Implement finalized-result population, null denominator, sample size, and minimum-threshold semantics
- [x] 7.5 Implement equal-duration prior-window comparisons using the same Metric Version and filters
- [x] 7.6 Add fixture-based calculation tests including unresolved probes, corrections, empty windows, and sparse samples

## 8. Reporting and dashboards

- [x] 8.1 Implement course-level learner progress query interfaces and report projections
- [x] 8.2 Implement Teacher dashboard for classes, upcoming sessions, attendance, and learner progress
- [x] 8.3 Implement read-only Learner dashboard for own schedule, attendance, and progress
- [x] 8.4 Add session, week, month, and custom Report Window controls
- [x] 8.5 Display metric definitions, sample sizes, direction, and experimental status with charts
- [x] 8.6 Add responsive mobile and desktop accessibility tests for assessment and reporting flows

## 9. Realtime and operational verification

- [x] 9.1 Publish only required current snapshot tables to Supabase Realtime
- [x] 9.2 Implement class-scoped realtime subscriptions for active assessment capture
- [x] 9.3 Add reconciliation diagnostics that detect event/snapshot divergence
- [x] 9.4 Verify Storage and Realtime authorization obey the same role and organization rules
- [x] 9.5 Run the seeded end-to-end flow from login through schedule, attendance, assessment, probes, correction, and reporting
- [x] 9.6 Document local setup, environment configuration, architecture seams, metric caveats, and deployment prerequisites
