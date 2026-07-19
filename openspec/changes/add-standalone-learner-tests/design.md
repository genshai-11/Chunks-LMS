## Context

The hosted project already contains a V2 package catalog and `live-test-generation` function, but the selected bugfix baseline lacks seven applied migrations. Hosted compatibility data contains one published 8×10 package whose CCI incorrectly mirrors CVR, and it is linked to one completed test Learning Session with ten attempts. The canonical workbook instead defines distinct CVR and CCI Ampe/name values. The requested runtime must not use Classes or existing Learning Sessions.

The authoritative technical detail is in [`specs/001-standalone-learner-tests/`](../../../specs/001-standalone-learner-tests/).

## Goals / Non-Goals

**Goals:**

- Reconcile hosted schema history into the feature branch.
- Guard and audit deletion of obsolete test-only data.
- Import the workbook deterministically with correct CVR/CCI/CPD provenance.
- Reuse immutable package and narration foundations.
- Add a separate one-Learner assignment/run/result aggregate.
- Harden RLS and privileged function exposure.
- Add Resource Admin, standalone Teacher runtime, and separate Test Results.

**Non-Goals:**

- No synthetic Class, Enrollment, or new live-session mode.
- No deletion of general LMS data.
- No automatic LLM content publication.
- No production apply/deploy without explicit reviewed approval.

## Decisions

### Reconcile before migration

Fetch/compare the seven remote-only migrations and deployed Edge source before creating new migration files. Selectively port relevant recovery modules; do not merge the recovery branch wholesale.

### Guarded transactional replacement

A preview records source/manifest hashes, validation findings, deletion counts, and the allowlisted dependency graph. Apply requires the matching confirmation token and rechecks counts/dependencies. Deletion and canonical insert occur transactionally.

### Workbook mapping

`CVR-id` is session target CVR. CCI `Ampe (A)` is CCI value. CCI names/descriptions/categories are retained. Session 1 Item 10’s `cci-002` remains source metadata while the session measurement maps `cci-001`.

### Separate standalone aggregate

New assignment/run/run-item/attempt/event/snapshot tables have no Class or Learning Session foreign key. Database RPCs enforce the accepted color/probe/correction lifecycle atomically.

### Secure catalog and runtime

New public tables use explicit grants and RLS. Privileged helpers move to a non-exposed schema where practical, use hardened search paths, and receive explicit EXECUTE grants. Teacher access is same-organization without Class enrollment; learner reads are self-only.

### Approved private narration

Use the deployed stable generation/narration/approval actions and a private narration bucket. Start requires an approved current intro plus ten approved current item narrations for selected language/voice. Later CVR-preview code is deferred.

## Risks / Trade-offs

- **Destructive reset removes one completed test session and ten attempts** → show exact impact and SQL, back up affected rows, require final approval, and execute transactionally.
- **Remote migration history differs from branch** → reconciliation commit precedes feature migrations.
- **Local Docker is unavailable** → do not substitute an unreviewed hosted apply; report SQL integration test gap until Docker is available.
- **Separate lifecycle tables duplicate storage shape** → share semantic helpers/RPC patterns; accept storage separation to preserve product boundary.
- **Generated audio costs/provider failures** → bounded retries, audited jobs, manual approval, per-session readiness, mock tests.
- **Existing public security-definer exposure** → security migration and advisor regression are prerequisites to remote runtime.

## Migration Plan

1. Create/commit clean worktree and Spec Kit/OpenSpec artifacts.
2. Link worktree and reconcile hosted migrations/Edge source.
3. Add security corrections and tests.
4. Add importer, preview/reset audit, and canonical manifest/seed tests.
5. Add standalone schema/RLS/RPCs and application slices.
6. Run full CI and local DB tests when Docker is available.
7. Before remote apply: commit/tag, backup affected test rows, show counts/SQL, obtain explicit approval.
8. Apply additive/security schema and guarded canonical replacement; create private bucket; run one learner/one session canary.
9. Rollback by disabling routes, restoring affected rows from backup, redeploying saved Edge v2 source, and retaining Storage objects until verification.

## Open Questions

None blocking local implementation. Remote destructive execution remains an explicit final approval gate.
