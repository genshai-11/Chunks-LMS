## 0. Architecture contract ticket progress (#4)

- [x] 0.1 Claim GitHub ticket before work and create isolated sibling git worktree
- [x] 0.2 Inspect OpenSpec state with `npx -y @fission-ai/openspec list --json`
- [x] 0.3 Preserve `add-live-test-resources` unchanged as the completed fixed 8×10 historical change
- [x] 0.4 Add V2 OpenSpec proposal/design/spec deltas for Auth, learner access, flexible packages, CVR/CCI/CPD, reporting, and generation
- [x] 0.5 Produce `docs/architecture/v2-domain-architecture-contract.md` with domain contract, ERD/schema proposal, compatibility matrix, RLS matrix, and deep-module interfaces
- [x] 0.6 Update `CONTEXT.md` only for resolved domain terms
- [x] 0.7 Add ADRs that meet domain-modeling criteria for Auth replacement and flexible immutable package model
- [x] 0.8 Run strict OpenSpec validation and docs/schema checks
- [x] 0.9 Commit architecture artifacts and resolve only ticket #4

## 1. Identity and signed learner access (#5, depends on #4)

- [ ] 1.1 Add Supabase Auth staff account mapping while preserving existing public User UUIDs
- [ ] 1.2 Add database-owned Admin/Teacher role grants and routing checks
- [ ] 1.3 Implement revocable expiring signed learner access without learner Auth accounts
- [ ] 1.4 Replace Clerk authorization paths and retain legacy identifiers only for migration/rollback evidence
- [ ] 1.5 Add RLS tests for Admin, Teacher, signed learner token, anon, and cross-scope denial

## 2. Flexible packages and measurement catalogs (#6, depends on #4; implementation should coordinate with #5 RLS seams)

- [ ] 2.1 Add `test_packages`, `test_package_versions`, `test_sections`, `test_items`, CCI Profile/Category, narration variant, audio, and generation job schema
- [ ] 2.2 Enforce draft mutability and published-version immutability
- [ ] 2.3 Store section-level `target_cvr_ohm` and CCI snapshots/overrides
- [ ] 2.4 Store item-level TC/LC/TL and `measured_cvr = TC × LC × TL` validation data
- [ ] 2.5 Preserve resource-agnostic Session Question identity through immutable external refs/snapshots

## 3. Hosted-data and CSV migration (#7, depends on #5 and #6)

- [ ] 3.1 Stage one-time `Chunks-resource - CVR_new.csv` import with dry-run validation
- [ ] 3.2 Backfill existing `live_test_resources`, `live_test_blocks`, and `live_test_items` into V2 package/version/section/item rows
- [ ] 3.3 Map old `session_questions.external_ref` values to V2 immutable item snapshots without rewriting lifecycle history
- [ ] 3.4 Produce compatibility reports for row counts, external-ref resolution, section targets, measured CVR mismatches, CCI snapshot coverage, and CPD variance
- [ ] 3.5 Verify restore/rollback path before any remote migration approval request

## 4. CVR generation and TTS modules (#8, depends on #6 package drafts; server-side only)

- [ ] 4.1 Implement `generateTestItem` behind a server-side 9Router LLM adapter
- [ ] 4.2 Implement `generateNarration` behind a server-side 9Router TTS adapter
- [ ] 4.3 Store generation jobs, provider metadata, retries/errors, source hashes, and private Storage assets
- [ ] 4.4 Require human approval before generated content/audio can be published
- [ ] 4.5 Add tests proving provider secrets and adapter details are not exposed to browser callers

## 5. Admin package management and Teacher runtime (#9, depends on #5, #6, and #8 where generation is used)

- [ ] 5.1 Add Admin draft/package/version/section/item management with CSV preview
- [ ] 5.2 Add CCI Profile/Category selection and section snapshot/override UI
- [ ] 5.3 Add generated-content review and custom/generated audio approval surfaces
- [ ] 5.4 Add independent intro/item narration language and voice controls
- [ ] 5.5 Upgrade Teacher live-test runtime for flexible sections/items and deterministic selected package version/section playback

## 6. Correction-aware learner CPD reporting (#10, depends on #6 and #7)

- [ ] 6.1 Implement canonical report path for `item_cpd = target_cvr_ohm × CCI`
- [ ] 6.2 Implement `learner_cpd_score = item_cpd × finalized effective color score`
- [ ] 6.3 Join reports to correction-effective final results without duplicating result lifecycle rules in UI callers
- [ ] 6.4 Display sample sizes, definitions, and measurement snapshot/version provenance
- [ ] 6.5 Add regression tests for corrected results and historical package versions

## 7. Release hardening and controlled production readiness (#11, depends on #5 through #10)

- [ ] 7.1 Run strict OpenSpec validation, lint, typecheck, tests, and production build
- [ ] 7.2 Run Supabase local migration list/apply/advisor checks and RLS policy tests
- [ ] 7.3 Validate migration dry-run reports against hosted-data snapshots
- [ ] 7.4 Validate preview/canary deployment and two-browser Auth/access flows
- [ ] 7.5 Prepare commit/tag, rollback instructions, restore-path evidence, and explicit approval request for any production action
