## 1. OpenSpec and domain docs

- [x] 1.1 Add OpenSpec proposal/design/spec deltas for live-test resources
- [x] 1.2 Update CONTEXT.md and UBIQUITOUS_LANGUAGE.md
- [x] 1.3 Add ADR for live-test resources and derived CPD

## 2. Database and resource import

- [x] 2.1 Add live-test/audio tables and Learning Session format fields
- [x] 2.2 Add constraints/RLS for lesson vs test sessions and resource access
- [x] 2.3 Add CSV import dry-run with 8×10 validation and CPD derivation
- [ ] 2.4 Seed local resource rows from chunks-resourcce data path when configured

## 3. Domain model and sync

- [x] 3.1 Add SessionFormat and PromptLanguage domain types
- [x] 3.2 Extend LearningSession persistence/sync with session format, prompt language, resource/block IDs
- [x] 3.3 Add live-test resource query helpers and CPD derivation helpers

## 4. Teacher session and observe UI

- [x] 4.1 Add Lesson/Test selector while preserving current lesson default
- [x] 4.2 Add resource/block/kind/prompt-language selection and test summary
- [x] 4.3 Add observe runner for live-test item sequence, selected-language prompts/audio, and external_ref capture

## 5. Reporting and charts

- [x] 5.1 Join finalized results to live-test metadata for reporting
- [ ] 5.2 Add filters for format, kind, prompt language, resource/block, and CVR/CCI/CPD bands
- [ ] 5.3 Add test-specific chart/table surfaces for item difficulty and CPD bands

## 6. Verification

- [x] 6.1 Add/update domain and import tests
- [x] 6.2 Run npm run openspec:validate
- [x] 6.3 Run lint, typecheck, test, and build
- [x] 6.4 Document no-production-deploy status and release controls
