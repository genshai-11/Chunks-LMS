# Data Model — Standalone Learner Tests

## Existing catalog entities to reconcile/reuse

### TestPackage

- `id`, `organization_id`, `title`, `slug`, `description`
- `source_metadata`, creator and archive timestamps
- Unique `(organization_id, slug)`

### TestPackageVersion

- Belongs to TestPackage
- `version_label`, `status: draft|published|archived`, snapshot hash
- Published/archived versions are immutable

### CciProfile / CciCategory

- Profile is versioned and organization-scoped
- Category contains source CCI ID, CCI Name, Ampe value, description, optional category, and metadata
- Active/published measurement inputs are immutable

### TestSection

- Belongs to one package version
- Ordered `section_order`
- `target_cvr_ohm`
- CCI references/snapshot
- VI/EN introduction text
- Canonical metadata includes source session and package rows

### SectionMeasurementSnapshot

- Immutable CVR + CCI profile/category/name/value provenance
- Optional superseding snapshot with reason
- `item_cpd = target_cvr_ohm × cci_value`

### TestItem

- Belongs to package version and section
- Ordered `item_order`
- Source material/item/CCI/CVR identifiers
- VI/EN term and complete-sentence prompt
- Source metadata preserves anomalies

### NarrationVariant / GenerationJob / AudioAsset

- Narration target is `section_intro` or `test_item`
- Language `vi|en`, voice, source hash, approval state
- AudioAsset references private Storage object
- GenerationJob records request, attempts, provider metadata, status, and errors

## Import/reset audit entities

### TestCatalogImportRun

Fields:

- `id`, `organization_id`
- `source_filename`, `source_sha256`
- `status: previewed|confirmed|running|succeeded|failed|cancelled`
- `manifest_sha256`
- `preview_counts` and `actual_counts` JSON
- `validation_issues` JSON
- `deletion_scope` JSON
- actor IDs and preview/confirm/start/complete timestamps
- failure code/message

Rules:

- A confirmation token hashes source, manifest, preview counts, and deletion scope.
- Execution rejects a token if current counts/dependencies differ.
- Successful import records canonical package/version IDs.
- Audit rows are not deleted by the reset they describe.

## New standalone execution entities

### StandaloneTestAssignment

Fields:

- `id`, `organization_id`
- `learner_user_id`, `package_version_id`
- `assigned_by_user_id`
- `assignment_number`
- `status: active|completed|cancelled`
- timestamps

Rules:

- Learner is active and belongs to the same organization.
- Package version is published.
- Retakes create a new assignment number; prior assignments are not overwritten.

### StandaloneTestRun

Fields:

- `id`, `organization_id`, `assignment_id`
- `learner_user_id`, `test_section_id`
- `section_measurement_snapshot_id`
- `attempt_number`
- `prompt_language: vi|en`
- `voice_id`
- approved intro narration variant ID
- snapshotted session number, CVR, CCI ID/name/value, item CPD
- `status: draft|ready|in_progress|completed|cancelled`
- started/completed/cancelled timestamps and actor IDs

Rules:

- Exactly one learner, matching the assignment.
- Section belongs to the assignment’s published package version.
- At most one `ready|in_progress` run per assignment/section.
- Transition to `ready` requires a complete current narration set.
- Transition to `in_progress` freezes runtime settings and ordered items.

### StandaloneTestRunItem

Fields:

- `id`, `run_id`, `test_item_id`, `item_order`
- source item/version hashes
- snapshotted VI/EN prompt selected for the run
- approved narration variant/audio asset IDs
- snapshotted CVR, CCI and item CPD provenance

Rules:

- Exactly ten rows for this canonical package session.
- Unique `(run_id, item_order)` and `(run_id, test_item_id)`.
- Rows become immutable when run starts.

### StandaloneTestAttempt

Fields:

- `id`, `run_id`, `run_item_id`, `learner_user_id`
- creator/actor and timestamps
- Unique `(run_id, run_item_id)`

### StandaloneTestEvent

Fields:

- `id`, `attempt_id`, `event_sequence`
- `event_type`: provisional recorded, probe failed/continued/completed, finalized, corrected
- color/probe payload, correction reason, actor, timestamp

Rules:

- Append-only.
- Unique `(attempt_id, event_sequence)`.
- Correction requires reason and preserves prior finalization.

### StandaloneTestAttemptSnapshot

Fields:

- `attempt_id` primary key
- lifecycle status, provisional/effective color and score
- entered probe flow, probe count, max probe count
- finalized/corrected timestamps and latest event sequence

Rules:

- Updated only by database transition RPCs in the same transaction as event append.
- Only `finalized|corrected` snapshots feed reports.

## Relationships

```text
TestPackage 1 -> N TestPackageVersion
TestPackageVersion 1 -> N TestSection 1 -> N TestItem
TestSection 1 -> N SectionMeasurementSnapshot
TestSection/TestItem 1 -> N NarrationVariant
TestPackageVersion 1 -> N StandaloneTestAssignment
StandaloneTestAssignment 1 -> N StandaloneTestRun
StandaloneTestRun 1 -> 10 StandaloneTestRunItem
StandaloneTestRunItem 1 -> 1 StandaloneTestAttempt
StandaloneTestAttempt 1 -> N StandaloneTestEvent
StandaloneTestAttempt 1 -> 1 StandaloneTestAttemptSnapshot
```

## State transitions

### Import run

`previewed -> confirmed -> running -> succeeded|failed`

- `previewed -> cancelled` allowed.
- Count/dependency drift returns to a new preview; it never reuses the old confirmation.

### Assignment

`active -> completed|cancelled`

- Completed after all required package sections have a completed run.

### Run

`draft -> ready -> in_progress -> completed`

- `draft|ready -> cancelled` allowed.
- `in_progress -> cancelled` requires a reason and retains recorded events.
- Completed runs are immutable.

### Attempt snapshot

Use the accepted measurement lifecycle:

- draft -> finalized Red/Yellow/Purple
- draft -> probe_open on Green
- probe_open -> finalized Yellow on Fail
- probe_open -> probe_open on Continue below ceiling
- probe_open/resolution_required -> finalized Green on Done
- finalized -> corrected through append-only correction

## Reset deletion graph

Allowed old test-only graph, evaluated by source/package identity:

1. linked assessment events and snapshots
2. linked assessment attempts
3. linked session questions
4. linked legacy/V2 test Learning Sessions only
5. live-test V2 mapping/staging rows for the obsolete source
6. obsolete measurement snapshots, test items, sections, package versions/packages
7. obsolete narration/generation/audio catalog rows and private objects when exclusively owned
8. obsolete legacy live-test items, blocks, resources

Explicitly excluded:

- organizations, users, learner profiles, staff roles
- courses, classes, enrollments
- scheduled sessions and lesson-format Learning Sessions
- lesson assessment attempts/events/snapshots
- metric templates and non-test reporting history

Any dependency outside the allowlist aborts the transaction.
