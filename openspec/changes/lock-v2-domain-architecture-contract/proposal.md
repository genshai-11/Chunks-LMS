## Why

The completed `add-live-test-resources` OpenSpec change delivered a fixed 8×10 Live Test shape and Clerk-era access posture. V2 now needs a migration-safe architecture contract before implementation begins: native Supabase Auth for staff, signed learner access without learner Auth accounts, flexible immutable Live Test Packages, CVR/CCI/CPD reporting, and 9Router-backed generation/TTS modules.

## What Changes

- Supersede the fixed 8×10 Live Test target model with flexible Live Test Packages, immutable Package Versions, Test Sections, Test Items, CCI Profiles/Categories, measurement snapshots, independent narration variants, and auditable generation jobs.
- Replace the V1 Clerk identity target with native Supabase Auth for Admin/Teacher and revocable expiring signed learner access for Learners.
- Lock the CPD formulas: `target_cvr_ohm` is section-level from CSV `Unit (Ohm)`, `measured_cvr = TC × LC × TL` is item-level validation, `item_cpd = target_cvr_ohm × CCI`, and `learner_cpd_score = item_cpd × finalized effective color score`.
- Define the ERD/schema proposal, hosted-data compatibility matrix, RLS access matrix, and deep-module interfaces in `docs/architecture/v2-domain-architecture-contract.md`.
- Add ADRs for Supabase Auth/signed learner access and flexible immutable Live Test Packages.
- Keep `add-live-test-resources` unchanged and preserve all hosted assessment/session/correction history in later migration work.

## Capabilities

### Modified Capabilities

- `identity-access`: Supabase Auth staff identity, singleton Chunks Workspace scope, database-owned roles, and signed learner access.
- `course-roster`: Teacher scope derives through Teacher-owned Classes and active Enrollments in the singleton workspace.
- `session-scheduling`: test Learning Sessions select immutable Package Versions and Test Sections rather than fixed blocks.
- `assessment-capture`: Session Questions keep resource-agnostic identity while linking to immutable Test Item snapshots.
- `metric-templates`: CVR/CCI/CPD formulas and immutable measurement snapshots replace fixed item CPD assumptions.
- `progress-reporting`: learner CPD scoring uses finalized/corrected effective results joined to immutable section/item measurements.

### New Capabilities

- `live-test-generation`: server-side generation and narration modules hide 9Router LLM/TTS adapters, secrets, retries, Storage, and approval workflow behind small interfaces.

## Impact

- Architecture/docs only in this ticket.
- Future Supabase migrations will be additive/migration-safe and must use the compatibility matrix before touching hosted data.
- Future RLS implementation must use the access matrix and Supabase RLS best practices: RLS enabled on exposed tables, `TO` clauses, `(select auth.uid())`, indexed policy predicates, no user-editable metadata authorization, private privileged helpers only where justified.
- Future UI and Edge Functions must call deep modules instead of duplicating token, package, CPD, generation, or correction-effective logic.

## Non-goals and product boundary

- No database migration, Auth replacement, Edge Function, UI, or production deployment in this ticket.
- No learner Supabase Auth accounts in this version.
- No multi-organization product UI.
- No general-purpose content authoring outside versioned Live Test Packages.
- No rewriting of the completed `add-live-test-resources` change or existing hosted assessment history.
- No remote Supabase migration, Vercel deploy, push to main/master, or other production-impacting action.
