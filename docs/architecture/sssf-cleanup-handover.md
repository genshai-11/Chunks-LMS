# SSSF Cleanup and Scoped Sync Handover

**Status:** Complete  
**Scope:** Dead-code removal, SSSF runtime-artifact hygiene, atomic workspace sync, and Teacher data scoping  
**Branch:** `refactor/cleanup-and-sssf-hygiene`

## 1. Summary

This handover covers two related change sets visible in the repository diff: removal of application code that was no longer wired into the active product, plus the new RPC-first workspace synchronization and Teacher-scoped data path.

The cleanup cutover is direct: the `/chunker` route and its import are gone, Observe no longer supports returning to Chunker, and the attendance-matrix implementation is removed together with its dedicated types, test assertions, and CSS. No replacement compatibility route, re-export, or deprecated alias was added.

The synchronization change adds a migration-backed revision store, scoped snapshot reads, atomic workspace writes with optimistic concurrency control (OCC), client-side revision tracking, cloud-over-cache boot precedence, and a Teacher Overview filter that excludes learners outside the Teacher's operable classes.

## 2. Removed application surfaces

### 2.1 Chunker page and route

The following were removed as one feature slice:

- `web/src/pages/ChunkerPage.tsx`;
- the `ChunkerPage` import in `web/src/App.tsx`;
- the `/chunker` route in `web/src/App.tsx`;
- 117 lines of `.chunker-*` styling in `web/src/index.css`.

This eliminates an otherwise standalone, unauthenticated learner/session console from the active router and removes its now-unreachable presentation layer. Because the route itself was deleted rather than redirected, `/chunker` now follows the application's existing catch-all behavior and redirects to `/`.

### 2.2 Observe navigation tied to Chunker

`web/src/pages/teacher/TeacherObservePage.tsx` no longer reads the `from=chunker` query parameter. The page now uses `/teacher/session` as its single exit path.

The associated `useSearchParams` import and conditional navigation logic were removed. This keeps the active Observe workflow independent of the deleted route and avoids retaining a dead entry-point contract.

### 2.3 Teacher progress page

`web/src/pages/teacher/TeacherProgressPage.tsx` was deleted. The current router does not import this component; `/teacher/progress` remains an existing redirect to `/teacher/analysis` in `web/src/App.tsx`.

Removing the unreferenced page reduces duplicate progress/reporting UI code without changing the current route behavior.

### 2.4 Catalog improv service

`web/src/modules/catalog/improv-service.ts` was deleted. The removed file contained an isolated Improv/Red Test integration layer, including its own domain models, package-building helpers, session utilities, local-storage persistence, CSV parsing, and file-loading functions.

No active import or caller is changed elsewhere in this cleanup. Its deletion therefore removes an unwired alternative catalog/session abstraction rather than changing the live catalog path.

### 2.5 Attendance matrix

The attendance-matrix slice was removed consistently across implementation, types, tests, and styles:

- deleted `web/src/modules/ops/attendance-matrix.ts`;
- removed `AttendanceMatrixCell`, `AttendanceMatrixRow`, and `AttendanceMatrix` from `web/src/modules/ops/types.ts`;
- removed the now-unused `AttendanceStatus` type import from that file;
- removed the `buildAttendanceMatrix` import and matrix assertions from `web/src/modules/ops/ops.test.ts`;
- renamed the remaining test group from `ops board & attendance matrix` to `ops board`;
- removed 31 lines of `.attendance-matrix*` styling from `web/src/index.css`.

The retained ops-board tests continue to cover the remaining `buildSessionOpsRows` behavior. The cleanup does not replace the matrix with another implementation; it removes the unused parallel representation and all code dedicated solely to it.

## 3. SSSF repository hygiene

`.gitignore` now excludes local SSSF and Python runtime artifacts:

```gitignore
# sssf runtime
adws/adw_data/sessions/
adws/adw_data/sssf.db*
__pycache__/
*.pyc
```

These rules keep generated session data, the SSSF SQLite database and its sidecar files, Python bytecode caches, and compiled Python files out of version control. Source files and durable SSSF configuration remain unaffected by these patterns.

## 4. Atomic workspace sync and Teacher scoping

### 4.1 Database migration

`supabase/migrations/20261001000000_atomic_workspace_sync_and_scoping.sql` adds:

- `organization_workspace_versions`, keyed by `organization_id`, with `revision`, `updated_at`, `updated_by`, and optional `checksum`;
- `get_workspace_snapshot(p_organization_id)`, a `security definer` RPC that requires a staff identity and returns workspace JSON plus the current revision;
- `sync_workspace_atomic(p_organization_id, p_expected_revision, p_payload)`, a `security definer` RPC that locks the organization revision row, rejects stale revisions, performs its supported upserts in one PostgreSQL transaction, and increments the revision on success.

The snapshot scope is role-dependent:

- Admin receives organization-wide courses, classes, enrollments, users, scheduled sessions, learning sessions, and attendance.
- Teacher receives only courses containing their assigned classes; their assigned classes; enrollments and learners for those classes; their own profile; and scheduled sessions, learning sessions, and attendance attached to those classes.

The write RPC upserts users and organization memberships, courses, classes, enrollments, scheduled sessions, and learning sessions. Non-admin class rows whose `teacherUserId` is not the current actor are skipped. Non-admin enrollment and session rows are skipped unless their class belongs to the actor.

The OCC comparison implemented by the migration rejects `p_expected_revision` when it is lower than the server revision and returns `CONFLICT_REVISION_MISMATCH` plus `serverRevision`. A successful write advances `organization_workspace_versions.revision` and returns the new value.

### 4.2 Supabase client integration

`web/src/lib/supabase-sync.ts` now:

1. attempts `get_workspace_snapshot` before the legacy REST read queries;
2. maps the scoped RPC JSON into the existing `RosterState` and `SchedulingState` shapes and returns its revision;
3. attempts `sync_workspace_atomic` before the legacy REST save sequence;
4. sends normalized roster/scheduling data and the optional expected revision;
5. returns `newRevision` on success or structured conflict metadata on OCC rejection.

The existing REST read/write paths remain as compatibility fallbacks when the RPC is absent, errors, or does not return a usable payload. They must not be treated as transactionally equivalent: the fallback write is still the previous multi-request waterfall and does not return an OCC revision.

The client includes `scheduling.attendance` in `p_payload`, but this migration's `sync_workspace_atomic` body does not currently consume that array. The RPC also implements upserts rather than the legacy prune/delete behavior. Maintainers must account for these boundaries when changing attendance or destructive-sync flows.

### 4.3 AppState revision and bootstrap behavior

`web/src/state/AppState.tsx` stores the revision returned by boot or manual reload in `workspaceRevision`. Debounced saves and `syncNow` pass that value as `expectedRevision`; successful RPC writes replace it with `newRevision`.

On an OCC conflict, the debounced path enters the error state and tells the operator to reload rather than silently overwriting newer server data. The explicit `syncNow` path returns failure through its existing write-error flow.

For authenticated staff boot, any non-empty remote workspace now makes the cloud roster authoritative even when browser cache has a greater local weight. Scheduling still uses the existing merge so open remote sessions survive. Local-to-cloud bootstrap remains available only when the remote workspace is empty.

### 4.4 Teacher Overview defense in depth

`web/src/pages/teacher/TeacherOverviewPage.tsx` now reads the staff role and builds the set of classes exposed by `useTeacherClassContext`.

- Teacher view keeps only learners actively enrolled in an operable Teacher class; when classes are selected, the learner must be enrolled in one of those selected classes. Learners from another Teacher and unassigned learners are excluded.
- Admin view retains organization-wide behavior and can still include unassigned learners when a class selection is active.

This UI filter complements the server-side snapshot scope. It is not the authorization boundary by itself.

## 5. Safety boundaries and cutover rationale

The changes follow the dependency and ownership edges visible in the diff rather than leaving partial feature remnants:

1. **Router cutover is complete.** The Chunker import and route are removed together.
2. **Downstream navigation is complete.** Observe no longer constructs a return path to `/chunker`.
3. **Attendance-matrix ownership is complete.** Implementation, dedicated public types, test expectations, and CSS are removed as one unit.
4. **Unreferenced pages and services are deleted at their source.** No aliases or compatibility wrappers preserve the dead modules.
5. **Active route behavior is retained.** `/teacher/progress` continues to redirect to `/teacher/analysis`; Observe exits to the existing `/teacher/session` route.
6. **Generated state is separated from source.** SSSF runtime data is ignored without changing application behavior.
7. **Scoped reads are server-side.** `get_workspace_snapshot` builds Admin and Teacher projections before data reaches the browser.
8. **Teacher writes have ownership checks.** The atomic RPC skips non-admin class, enrollment, and session rows outside the current Teacher's classes.
9. **Stale writes are surfaced.** AppState carries the revision returned by the server and exposes OCC rejection as an error requiring reload.
10. **Compatibility behavior is explicit.** The legacy REST fallback remains available, but this handover records that it does not inherit atomicity or OCC from the RPC path.

## 6. Architectural benefits

### Smaller supported surface

Deleting inactive pages and services narrows the set of modules that maintainers might otherwise mistake for supported product flows. The router is a clearer statement of the application's live navigation model.

### Fewer parallel domain models

Removing the standalone Improv service and attendance-matrix types avoids maintaining domain representations that are not used by active callers. The remaining ops module exposes only the session-operations model still exercised by its test suite.

### Cleaner feature boundaries

Observe now belongs solely to the teacher-session flow. It no longer contains knowledge of a separate Chunker entry point, reducing coupling between an active teacher workflow and a removed standalone page.

### Lower styling and test maintenance cost

Feature-specific CSS and matrix-only assertions were removed alongside their implementations. Future stylesheet searches and ops-test failures therefore refer to active behavior rather than deleted UI.

### Cleaner SSSF working trees

Ignoring transient SSSF database/session files and Python caches prevents generated execution state from obscuring meaningful source changes during review and handoff.

## 7. Baseline verification

The handover already records the following cleanup quality-gate results. They establish the baseline for the removal slice; no additional migration/RPC execution result is asserted here.

| Gate | Result |
|---|---|
| TypeScript project build (`tsc -b`) | Passed with 0 errors |
| Vitest | Passed: 47 of 47 test files, 231 tests |
| Production build | Passed |

Together, these recorded results establish that the remaining TypeScript references resolved, the retained automated cleanup baseline passed, and the application produced a production build after the removals. The main integration workflow remains responsible for validating the new migration and RPC-backed paths.

## 8. Handover notes

- `/chunker` is no longer an application route; consumers should use the supported teacher-session flow.
- `TeacherObservePage` always exits to `/teacher/session`; `from=chunker` no longer has behavior.
- Do not import the deleted attendance-matrix types or reconstruct the removed matrix as an ops-board dependency without a new product requirement.
- `/teacher/progress` is still supported only as a redirect to `/teacher/analysis`, not as a separate page implementation.
- SSSF runtime databases and session outputs are local execution artifacts and should not be force-added to version control.
- Apply `20261001000000_atomic_workspace_sync_and_scoping.sql` before expecting RPC-first behavior; otherwise the client intentionally uses the legacy REST fallback.
- Treat `organization_workspace_versions.revision` as the OCC token shared by boot, reload, debounced save, and `syncNow`.
- A conflict is a reload signal, not permission to retry with an unversioned overwrite.
- The atomic RPC currently does not persist the attendance array or implement prune/delete semantics; do not assume parity with every branch of the legacy save path.
- Teacher visibility must remain constrained at both server snapshot scope and UI projection; Admin remains the only organization-wide role.
