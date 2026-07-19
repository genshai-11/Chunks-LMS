## Context

Wayfinder map [Find the safe route to Supabase Auth and flexible Live Test V2](https://github.com/genshai-11/Chunks-LMS/issues/3) is finding the safe route from the current Clerk + fixed 8×10 Live Test implementation to a migration-safe V2. The current worktree for `feat/live-test-resources-cpd` is dirty, so this contract is authored in an isolated sibling worktree and does not touch production systems.

The existing `add-live-test-resources` OpenSpec change is complete and must remain an accurate historical record. It established live-test resources, blocks, items, prompt language, and CPD from item CVR × CCI. V2 supersedes that target with flexible versioned packages and corrected measurement ownership while preserving hosted data through migration compatibility.

## Goals

- Lock the V2 domain terms and architecture before implementation begins.
- Define staff Supabase Auth and signed learner access without learner Auth accounts.
- Define flexible immutable Live Test Packages, CCI Profiles/Categories, measurement snapshots, narration variants, and generation jobs.
- Define migration compatibility rules that preserve hosted data and do not rewrite assessment/probe/finalization/correction history.
- Define RLS access expectations and deep-module interfaces.
- Keep production untouched.

## Decisions

1. **Supabase Auth is staff-only identity in this version.** Admin and Teacher authenticate through native Supabase Auth. Learners remain profile-only and use revocable expiring signed learner access. This supersedes ADR 0002 for V2.
2. **Chunks Workspace is singleton.** Admin sees all workspace data. Teacher scope is not organization membership; it is derived through Teacher-owned Classes and active Enrollments.
3. **Live Test Package replaces fixed Test Resource as the target model.** Package Versions can be draft/published/archived. Drafts are mutable; published versions and their measurement/audio snapshots are immutable.
4. **Test Section replaces fixed Test Block as target vocabulary.** Section and item counts are flexible. Existing fixed 8×10 rows migrate into flexible sections/items but do not constrain future packages.
5. **Resource-agnostic Session Question identity remains.** Test Items are linked only through immutable external references/snapshots. Session Question sequence remains presentation, not identity.
6. **Measurement ownership is split.** `target_cvr_ohm` is section-level from CSV `Unit (Ohm)`. `measured_cvr = TC × LC × TL` is item-level validation. CCI comes from CCI Profile/Category snapshots.
7. **CPD formulas are canonical.** `item_cpd = target_cvr_ohm × CCI`. `learner_cpd_score = item_cpd × finalized effective color score`, including correction-effective results.
8. **Narration is independent.** Intro narration and item narration independently choose language and voice. Audio assets live in private Storage and are referenced by approved/generated variants.
9. **9Router is server-side only.** Generation and TTS provider details sit behind deep modules; browser callers never see secrets or provider-specific interfaces.
10. **CSV is one-time input.** `Chunks-resource - CVR_new.csv` is migration/staging evidence, not runtime truth after Package Versions are published.
11. **No production action.** Later tickets must produce dry-run/advisor/preview/rollback evidence and explicit approval before remote migration or deploy.

## Contract artifacts

The detailed contract lives in `docs/architecture/v2-domain-architecture-contract.md` and includes:

- locked domain decision table;
- target domain contract;
- ERD/schema proposal;
- migration compatibility matrix preserving hosted data;
- RLS access matrix;
- deep-module interfaces;
- dependency path for tickets #5 through #11;
- future validation gates.

Domain terms are captured in `CONTEXT.md`. ADRs added:

- `docs/adr/0006-supabase-auth-and-signed-learner-access.md`;
- `docs/adr/0007-flexible-immutable-live-test-packages.md`.

## Deep module seams

The target implementation should expose small interfaces rather than table-by-table repositories:

- `StaffAccessGateway` resolves staff sessions and role/class authorization.
- `LearnerAccessGateway` issues, verifies, and revokes learner access tokens.
- `TestPackageCatalog` previews CSV import, saves drafts, publishes package versions, and plans section questions.
- `MeasurementCatalog` manages CCI Profiles/Categories, section measurement snapshots, and item CPD calculation.
- `LiveTestGeneration` queues/approves item generation and narration generation via server-side 9Router adapters.
- `CpdReporting` calculates learner CPD reports from immutable measurements and correction-effective final results.

## Migration strategy

Later implementation must be additive and reversible until cutover:

1. Introduce new tables/columns beside existing Clerk/live-test structures.
2. Backfill staff Auth links and role grants from current users/Clerk references without changing public user UUIDs.
3. Backfill package/version/section/item rows from existing live-test rows; preserve old rows through verification and rollback window.
4. Create compatibility mapping for old `session_questions.external_ref` values so every historical question resolves to a V2 immutable item snapshot.
5. Compare old and V2 CPD formulas and record accepted differences before enabling V2 reporting.
6. Keep assessment attempts, immutable events, final results, corrections, sessions, and attendance row counts stable.
7. Only after local/dry-run/advisor/preview validation and explicit approval may a separate release ticket apply remote migrations or production deploys.

## RLS strategy

- Enable RLS on every table in exposed schemas.
- Prefer policy `TO` clauses and wrapped auth helpers such as `(select auth.uid())`.
- Index every role, class, learner, package, and token-scope column used by policy predicates.
- Never authorize from `raw_user_meta_data` or other user-editable claims.
- Keep privileged helpers in private schemas, with explicit `auth.uid()` checks and revoked public execute, only when the policy cost/shape justifies it.
- Exposed views must use `security_invoker = true` on Postgres 15+ or remain private.
- Learner token reads should go through server modules/RPCs that validate token hashes, expiry, revocation, and scope before returning scoped read models.

## Risks / trade-offs

- **Auth migration risk:** Supabase Auth simplifies RLS ownership but requires careful user mapping and rollback evidence from Clerk-era identifiers.
- **Token access risk:** Learner tokens avoid learner Auth accounts but need strict hashing, TTL, revocation, and server-side scope enforcement.
- **Measurement migration risk:** Moving from item `cvr_value × cci_value` to section target × CCI can change CPD values. The compatibility matrix requires comparison reports, not silent replacement.
- **Package flexibility risk:** Flexible versions require a deeper catalog model and immutable snapshots; this prevents mutable content from changing historical reports.
- **Generation risk:** LLM/TTS output must remain human-approved before publish to keep Chunks-LMS out of unbounded content authoring.

## CI/CD and release controls

This ticket runs only local validation and commit. Future production release requires CI green, preview/canary validation, commit/tag, rollback instructions, restore-path verification, and Lucy's explicit approval for the exact production action. No remote Supabase migration, Edge Function deploy, Vercel deploy, or push to main/master is allowed by this contract ticket.
