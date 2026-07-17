## Context

Chunks-LMS currently measures Focus and Awareness through teacher-observed live sessions. Session Questions are resource-agnostic measurement opportunities with optional `external_ref`. Lucy needs a live-test extension where the teacher selects a predefined test block, chooses Vietnamese or English prompt language, and observes learners against fixed prompts.

## Goals

- Preserve current live lesson behavior.
- Add resource-driven live-test input for pretest/posttest.
- Store CVR and CCI source measurements so CPD can be recomputed.
- Keep Session Question identity independent from prompt content.
- Support language-specific audio/display from CSV complete sentence columns.

## Decisions

### Session format is separate from session kind

`session_kind` remains `regular | pretest | posttest`. A new `session_format` field distinguishes `lesson | test`. This prevents overloading pretest/posttest as behavior modes.

### Prompt language is a session setting

`prompt_language` is stored on test Learning Sessions. It selects `prompt_vi` or `prompt_en` at runtime; it does not create separate Test Item identities.

### Test resources are input metadata, not assessment identity

`live_test_items` store prompts, audio links, CVR/CCI metadata, and derived CPD. `session_questions.external_ref = live-test-item:<id>` links capture to that metadata.

### CPD is derived and reproducible

Each item stores CVR value/label/breakdown and CCI value/label/source. CPD is computed from `CVR × CCI`, not authored independently.

### Audio assets are stored outside row payloads

Audio files live in storage and are referenced via `audio_assets`, avoiding binary payloads in Postgres rows.

## Data shape

- `live_test_resources`: title/version/status/source metadata.
- `live_test_blocks`: block number, aggregate CCI/CVR/CPD, intro text/audio by language.
- `live_test_items`: item number, terms, Vietnamese/English prompts, CVR/CCI metadata, generated CPD, item audio by language.
- `learning_sessions`: format, prompt language, selected resource/block.

## Alternatives considered

- Add `live-test` to `session_kind`: rejected because kind already means baseline/reporting purpose.
- Store only CPD: rejected because Lucy requires records to recalculate CPD from CVR and CCI.
- Copy prompt text into Session Questions: rejected because it weakens the accepted resource-agnostic Session Question ADR.

## Migration and rollout

The migration is additive and defaults all existing sessions to `lesson`, so current live behavior remains compatible. Resources can be seeded as draft until all prompt/CVR rows are complete.

## CI/CD path

Validate by running OpenSpec validation, lint, typecheck, tests, and build. This change does not deploy production or apply remote migrations without explicit approval.
