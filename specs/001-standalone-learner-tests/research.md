# Research — Standalone Learner Tests

## Decision 1: Reconcile hosted migration history before feature migrations

**Decision**: Link the new worktree to project `ekubetkxfcuxlyahesrl`, fetch/recover the seven hosted 2026-07-19 migrations absent from the bugfix baseline, compare them with `fix/supabase-auth-resource-recovery`, and commit reconciliation separately.

**Rationale**: The hosted schema already contains the V2 package catalog, narration/generation tables, CPD RPCs, and auth changes. Creating a migration from the bugfix baseline would duplicate objects or overwrite newer contracts.

**Alternatives considered**:

- Base the branch on the recovery branch: rejected because the user required `bugfix/observe-session-fixes` and the recovery branch includes 40 unrelated auth/UI commits.
- Ignore remote history and write `IF NOT EXISTS` migrations: rejected because it conceals semantic drift and cannot prove replay safety.

## Decision 2: Reset only allowlisted test data in one guarded transaction

**Decision**: Implement a dry-run impact query and a transaction that identifies old rows by legacy resource/package provenance, validates that all dependencies belong to the test-only graph, deletes in FK order, inserts the canonical draft package, and aborts on count/token drift.

**Rationale**: The hosted compatibility package is linked to one completed test session and ten attempts. Catalog rows cannot be safely replaced without addressing those dependencies, but general LMS history must remain untouched.

**Alternatives considered**:

- Mutate the published compatibility package: rejected because published package/version and measurement history are immutable.
- Archive old data and keep both packages: rejected by the explicit request to delete obsolete database test data.
- Delete the entire organization/demo dataset: rejected because the request is limited to test/resource data.

## Decision 3: The workbook’s three sheets are the canonical mapping

**Decision**: Parse `Chunks-resource - CVR_new`, `Package-test`, and `CCI`; map `CVR-id` to session target CVR and `Ampe (A)` to CCI value. Retain CCI Name, description, category, identifiers, terms, and bilingual complete sentences.

**Rationale**: The prior importer expected columns absent from this workbook and incorrectly mapped odd CVR values into CCI. The canonical mapping produces CCI Ampe `2,2,4,4,6,6,8,8` and CVR `3,5,7,9,11,13,15,17`.

**Alternatives considered**:

- Continue using `Unit (Ohm)`/TC/LC/TL importer assumptions: rejected because those columns are absent.
- Infer item-level CCI from each row: rejected for CPD because package/session CCI is authoritative; item-level differences remain provenance warnings.

## Decision 4: Use a pinned Excel parser and deterministic manifest

**Decision**: Use a pinned, lockfile-committed workbook parser in the Node import tool, emit a canonical JSON manifest plus validation report, and generate idempotent SQL from the manifest. Dry-run is the default.

**Rationale**: The supplied workbook is an XLSX file and the current document CLI cannot reliably read its unsized worksheet metadata. A manifest makes review, hashing, tests, and SQL generation deterministic.

**Alternatives considered**:

- Hand-maintain 80 SQL rows: rejected because it is error-prone and breaks source reproducibility.
- Parse only the generated Markdown: rejected as the workbook itself is the source of truth.

## Decision 5: Standalone aggregate, shared measurement semantics

**Decision**: Add standalone assignment/run/item/attempt/event/snapshot tables with no Class, Enrollment, or Learning Session FK. Reuse the accepted color/probe/correction semantics through database transition functions and shared domain helpers.

**Rationale**: The user requires a completely separate 1-to-1 module. Hidden classes or nullable `learning_sessions.class_id` would preserve unwanted coupling.

**Alternatives considered**:

- Add another `session_format`: rejected because it merges the module into live sessions.
- Create a synthetic test class: rejected because it violates the no-Class requirement and leaks into roster/analysis.
- Generalize all assessment tables immediately: rejected as an oversized migration with high historical risk.

## Decision 6: Use private authorization helpers and explicit grants

**Decision**: Put new privileged authorization helpers in a non-exposed private schema, harden `search_path`, revoke PUBLIC/anon EXECUTE from sensitive public RPCs, grant only required authenticated/service roles, and add actor checks and RLS tests.

**Rationale**: Remote advisors report 21 anon- and 25 authenticated-executable `SECURITY DEFINER` functions. Several learner/generation RPCs have default exposure and no hardened `search_path`.

**Alternatives considered**:

- Rely on `TO authenticated`: rejected because authentication alone does not provide row authorization.
- Rely only on the UI/Edge JWT gate: rejected because direct Data API/RPC calls remain possible.

## Decision 7: Explicit Data API grants

**Decision**: New public tables receive explicit least-privilege grants plus RLS. Do not rely on automatic exposure.

**Rationale**: Supabase’s 2026 changelog notes new public tables are no longer automatically exposed to Data API/GraphQL.

## Decision 8: Stable deployed Edge actions for this release

**Decision**: Reconcile/download the deployed v2 Edge Function and retain the stable actions `generateTestItem`, `generateNarration`, and `approveGeneratedAsset`. Use 9Router TTS now; keep LLM content generation review-only. Do not deploy the recovery branch’s unreviewed `generateCVRPreview` addition.

**Rationale**: The deployed function is active with JWT verification and required 9Router secret names. Its adapters match the recovery branch, but its index is the earlier 598-line stable version. The later CVR preview code contains unreviewed behavior and is not required to run the canonical workbook.

## Decision 9: Private narration with approval and source hashes

**Decision**: Create a private `narration-audio` bucket, keep service credentials only in Edge Functions, store generated files under package/job paths, and make runtime reads use authorized/signed access. Start requires current approved intro and all ten item variants for the selected language/voice.

**Rationale**: The hosted project currently has no narration bucket and zero generation/variant rows. Generated but unapproved or stale audio must never reach test runtime.

## Decision 10: Separate profile Test Results

**Decision**: Add a dedicated Test Results route/tab under the teacher learner profile and query only standalone finalized/corrected results. Existing class Analysis remains unchanged.

**Rationale**: Standalone CPD uses package/session provenance and must not alter current live-session analysis semantics.

## Current platform constraints

- Hosted Postgres: 17.6.
- Supabase CLI: 2.109.0.
- Hosted Edge runtime: Deno 2.1-compatible.
- Local Docker/Supabase stack is currently unavailable.
- New worktree is not yet linked to the hosted project.
- PG14 deprecation is irrelevant because the project uses PG17.
