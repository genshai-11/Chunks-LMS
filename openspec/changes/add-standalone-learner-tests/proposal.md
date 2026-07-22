## Why

The hosted test catalog was built from an obsolete mapping that copied CVR values into CCI, while the canonical workbook defines separate session CVR and named CCI Ampe values. Teachers also need a one-to-one test workflow that is independent from Class-based live sessions and reports its CPD provenance separately.

## What Changes

- **BREAKING (test fixtures only)**: remove obsolete test/resource imports and explicitly reviewed dependent test-only history, then import the attached workbook as the canonical draft package.
- Add dry-run validation, source hashing, anomaly reporting, impact counts, and guarded final confirmation for catalog replacement.
- Add immutable package/session/item, CCI/CVR snapshot, and approved narration readiness management.
- Add a standalone one-Learner assignment/run/result module with no Class or Enrollment dependency.
- Add a separate learner-profile Test Results tab without changing existing Analysis.
- Harden resource/generation/result RLS and privileged RPC exposure before remote use.

### Non-goals and product-boundary check

- Do not turn Chunks-LMS into a general content-authoring/resource-library platform.
- Do not extend the existing live Learning Session mode or create synthetic Classes.
- Do not auto-publish LLM-generated content.
- Do not delete accounts, learners, classes, enrollments, or non-test history.

## Capabilities

### New Capabilities

- `test-package-catalog`: Canonical workbook replacement, immutable package versions, session CVR/CCI/CPD snapshots, and narration readiness.
- `standalone-test-execution`: One-to-one assignments, runs, ordered items, immutable results, resume/completion, and corrections outside Classes.

### Modified Capabilities

- `identity-access`: Teachers may run tests for active same-organization learners without Class enrollment; learners remain self-only.
- `result-lifecycle`: The accepted provisional/probe/finalization/correction invariants also govern standalone test attempts through a separate aggregate.
- `progress-reporting`: Learner profiles gain a separate standalone Test Results surface with CPD provenance; existing Analysis remains unchanged.

## Impact

- New guarded test catalog reset/import and standalone test database migrations/RLS/RPCs.
- Reconciliation of hosted V2 catalog/generation migrations into this bugfix-based branch.
- Admin resource/audio management and 9Router narration review.
- New Teacher test routes/runtime and learner Test Results route/tab.
- New workbook parser dependency, deterministic manifests, SQL/domain/component tests, and release/restore documentation.

**Active source**: [`specs/001-standalone-learner-tests/`](../../../specs/001-standalone-learner-tests/) is the authoritative Spec Kit workflow; this OpenSpec change is the repository-CI compatibility delta.
