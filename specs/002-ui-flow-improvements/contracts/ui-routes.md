# UI Route Contract

Reference contract for flow fixes, derived from `web/src/App.tsx` (2026-07-20, commit `0288ee1`). **Any route addition/rename/removal MUST update this file in the same commit (FR-008).**

## Public

| Route | View | Gate |
|---|---|---|
| `/` | `HomePage` (role picker) | none |
| `/chunker` | `ChunkerPage` | none |
| `/access` | `LearnerAccessPage` (invite link `?email=…`) | none |
| `*` | redirect → `/` | none |

## Admin — `StaffGate role="admin"` → `AdminLayout`

| Route | View |
|---|---|
| `/admin` | `AdminOverviewPage` |
| `/admin/ops` | `AdminOpsPage` |
| `/admin/attendance` | redirect → `/admin/ops` |
| `/admin/audit` | `AdminAuditPage` |
| `/admin/courses` | `AdminCoursesPage` |
| `/admin/classes` | `AdminClassesPage` |
| `/admin/people` | `AdminPeoplePage` |
| `/admin/enrollments` | `AdminEnrollmentsPage` |
| `/admin/analysis` | `AdminAnalysisPage` |
| `/admin/metrics` | `AdminMetricsPage` |
| `/admin/resources` | `AdminResourcesPage` |
| `/admin/resources/audio` | `AdminTestAudioPage` |

## Teacher — `StaffGate role="teacher"` → `TeacherLayout`

| Route | View |
|---|---|
| `/teacher/observe` | `TeacherObservePage` (**top-level, outside layout route**) |
| `/teacher` | `TeacherOverviewPage` |
| `/teacher/classes` | `TeacherClassesPage` |
| `/teacher/tests` | `TeacherTestsPage` |
| `/teacher/tests/:assignmentId/sections/:sectionId/setup` | `TeacherTestSetupPage` |
| `/teacher/test-runs/:runId` | `TeacherTestRunPage` |
| `/teacher/learner/:learnerId/tests` | `TeacherLearnerTestResultsPage` |
| `/teacher/learner/:learnerId` | `TeacherLearnerProfilePage` |
| `/teacher/session` | `TeacherSessionPage` |
| `/teacher/archive` | `TeacherArchivePage` |
| `/teacher/analysis` | `TeacherAnalysisPage` |
| `/teacher/progress` | redirect → `/teacher/analysis` |

## Learner — scoped invite portal (no staff auth) → `LearnerLayout`

| Route | View |
|---|---|
| `/learner` | `LearnerOverviewPage` |
| `/learner/enrollments` | `LearnerEnrollmentsPage` (multi-enrollment class picker) |
| `/learner/attendance` | redirect → `/learner` |
| `/learner/results` | redirect → `/learner/analysis` |
| `/learner/analysis` | `LearnerAnalysisPage` |
| `/learner/progress` | redirect → `/learner/analysis` |

## Invariants for flow fixes

1. `/teacher/observe` sits **outside** the `StaffGate`-wrapped `/teacher` layout route in `App.tsx` — any change to its gating must be deliberate and reviewed (FR-005).
2. Learner routes carry no `StaffGate`; scoping is enforced by the portal state (`activeLearnerUserId`) — never add staff data into these views (FR-004).
3. Legacy redirects (`attendance`, `progress`, `results`) must keep resolving; do not delete without owner confirmation.
