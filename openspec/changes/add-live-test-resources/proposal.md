## Why

Teachers need a resource-driven live-test flow for pretest/posttest where each test block has fixed prompts, language-specific audio, and CVR/CCI measurement metadata. Current live observation is intentionally resource-agnostic and should remain unchanged, but live-test needs prompt input and complexity metadata for test-specific analysis.

## What Changes

- Add a `lesson | test` session format alongside existing `regular | pretest | posttest` session kind.
- Add Test Resources with 8 ordered blocks and 10 ordered items per block.
- Add prompt language selection so live-test uses either `Complete Sentence (Vie)` or `Complete Sentence (Eng)` for item display/audio.
- Store CVR and CCI measurement values/labels per Test Item and derive CPD as `CVR × CCI`.
- Link Session Questions to Test Items through `external_ref` while preserving resource-agnostic assessment identity.
- Add import/seed path for `chunks-resourcce/Chunks-resource - CVR_generated.csv` and optional TTS generation.
- Add report filters/charts for test format, prompt language, resource/block, and CVR/CCI/CPD bands.

## Capabilities

### Modified Capabilities

- `session-scheduling`: Learning Sessions can be lesson or test format, with test prompt language and resource/block linkage.
- `assessment-capture`: Live-test creates Session Questions from selected Test Items without changing assessment lifecycle rules.
- `metric-templates`: CPD is defined as a derived resource metadata measure from CVR and CCI.
- `progress-reporting`: Reports can join finalized results to live-test metadata for CVR/CCI/CPD analysis.

## Impact

- Supabase schema: new live-test resource/audio tables and new Learning Session fields.
- Resource seed/import script for the 8×10 CSV.
- Teacher Start Session and Observe pages.
- Reporting joins, filters, and chart options.
- Tests for session format, prompt language, import validation, CPD derivation, and resource-linked capture.

## Non-goals and product boundary

- No general-purpose content authoring or resource-library platform.
- No change to current live lesson capture behavior.
- No destructive changes to assessment/probe/finalization/correction history.
- CVR/CCI/CPD are resource/test metadata; only finalized assessment results feed learner progress metrics such as RFC/RAC.
- No production deploy or remote Supabase migration without explicit approval.
