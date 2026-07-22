# Database RPC Contracts

All mutating RPCs require an authenticated actor, explicit role/organization checks, hardened `search_path`, explicit EXECUTE grants, and transactional event/snapshot updates.

## `preview_test_catalog_replacement(source_sha256, manifest)`

Returns:

- import run ID and confirmation token basis
- source/manifest hashes
- workbook validation summary
- canonical counts and section measurement summary
- deletion counts by table
- dependency exceptions
- warnings, including source item/session CCI mismatches
- `can_confirm` boolean

No catalog or assessment rows are changed.

## `apply_test_catalog_replacement(import_run_id, confirmation_token)`

Preconditions:

- actor is Admin;
- import run is `previewed`;
- source/manifest hashes match;
- current deletion counts and dependency graph match preview;
- no dependency outside the allowlist.

Behavior:

- runs one transaction;
- deletes the allowlisted obsolete test graph;
- inserts one canonical draft package, eight sessions, 80 items, CCI profile/categories, and measurement snapshots;
- records actual counts and canonical IDs;
- returns succeeded receipt.

On any error, all catalog/history changes roll back and the run records failure outside or after the failed transaction as supported by the implementation.

## `create_standalone_test_assignment(learner_id, package_version_id)`

Preconditions:

- actor is Teacher/Admin in same organization;
- learner is active in organization;
- package version is published.

Returns assignment ID, ordered section readiness, and next available section.

## `prepare_standalone_test_run(assignment_id, section_id, language, voice_id)`

Returns a draft/ready run preview containing:

- learner/package/section identity;
- session number, CVR, CCI ID/name/value, item CPD;
- selected language/voice;
- intro and ten item narration readiness;
- missing/stale/rejected narration details;
- `can_start` boolean.

## `start_standalone_test_run(run_id, readiness_token)`

Preconditions:

- same authorized actor scope;
- run still draft/ready;
- readiness token matches current package/measurement/narration hashes;
- intro and all ten item narrations approved/current.

Behavior:

- freezes run settings and ten run-item snapshots;
- transitions run to `in_progress`;
- returns ordered runtime payload.

## `record_standalone_provisional_result(run_item_id, color)`

Creates the attempt if needed, appends the provisional event, updates snapshot, and returns current attempt state.

## `resolve_standalone_probe(attempt_id, outcome)`

`outcome` is `fail|continue|done`. Enforces probe ceiling and returns current state.

## `correct_standalone_final_result(attempt_id, color, reason)`

Requires an authorized actor and nonblank reason. Appends correction event and returns corrected snapshot.

## `complete_standalone_test_run(run_id)`

Preconditions:

- all ten run items have finalized/corrected snapshots;
- actor owns/controls the run.

Returns completion receipt and assignment progress.

## `get_learner_standalone_test_results(learner_id, package_id?)`

Returns only authorized finalized/corrected standalone data:

- assignments/runs in reverse chronology;
- session and package provenance;
- result/probe/correction summaries;
- CVR, CCI, item CPD and learner CPD score;
- item detail.

Learner access is self-only; Teacher/Admin access is same-organization and role scoped.
