## ADDED Requirements

### Requirement: Canonical workbook replacement
The system SHALL validate the canonical workbook, preview exact test-only deletion impact, and replace obsolete test/resource data only after matching final confirmation.

#### Scenario: Preview canonical replacement
- **WHEN** an Admin previews the canonical workbook
- **THEN** the system reports one package, eight sessions, 80 items, all measurement mappings, anomalies, and deletion counts without changing data

#### Scenario: Destructive scope drifts
- **WHEN** current counts or dependencies differ from the confirmed preview
- **THEN** the replacement aborts without deleting or importing test data

### Requirement: Correct session measurement mapping
The system SHALL map workbook `CVR-id` to session CVR and workbook CCI `Ampe (A)` plus CCI Name to the immutable session measurement snapshot.

#### Scenario: Review eight session measurements
- **WHEN** the canonical draft is reviewed
- **THEN** CVR is `3,5,7,9,11,13,15,17` and CCI Ampe is `2,2,4,4,6,6,8,8` with workbook names

### Requirement: Source anomaly preservation
The system SHALL preserve item/session CCI mismatches as source metadata and review warnings rather than silently changing source values.

#### Scenario: Session 1 item 10 mismatch
- **WHEN** Session 1 Item 10 references `cci-002` while the session maps `cci-001`
- **THEN** the system retains both values and displays the mismatch warning

### Requirement: Immutable package publication
The system SHALL allow draft review and SHALL prevent in-place mutation or deletion of published package versions and measurement snapshots.

#### Scenario: Edit published session
- **WHEN** an Admin attempts to edit a published session measurement
- **THEN** the system rejects the edit and requires a new version or superseding snapshot

### Requirement: Narration readiness
The system SHALL track approved current introduction and item narration independently for each language and voice.

#### Scenario: Incomplete language audio
- **WHEN** any selected-language introduction or item narration is missing, stale, rejected, or unapproved
- **THEN** the session is not runtime-ready for that language and voice

### Requirement: Deterministic spoken scripts
The system SHALL prepare and persist the exact text sent to TTS before any paid generation action.

#### Scenario: Prepare a Session bundle
- **WHEN** an Admin prepares a language/voice bundle
- **THEN** the intro includes Session number, CVR, CCI Ampe, CCI Name, optional CCI Description, and `Start` or `Bắt đầu`, while each item begins with `Number n` or `Số n`

#### Scenario: Edit a saved script
- **WHEN** an Admin changes any intro or item script
- **THEN** prior audio with a different source hash is stale and cannot satisfy the current 11-asset readiness gate

### Requirement: Persistent private audio review
The system SHALL persist generation jobs, variants, private audio metadata, approval history, and review state across page reloads.

#### Scenario: Review generated narration
- **WHEN** an Admin reloads Audio Preparation
- **THEN** generated, approved, rejected, failed, and stale variants remain available for listen, regenerate, approve, or reject actions

#### Scenario: Discover and test 9Router models
- **WHEN** an Admin selects Vietnamese or English in Audio Preparation
- **THEN** the system fetches current 9Router TTS model/voice IDs server-side and allows generation for one row, multiple selected rows, or all missing/stale rows in that Session

#### Scenario: Change the selected TTS model
- **WHEN** an Admin chooses a different model or voice ID
- **THEN** readiness is recalculated independently because the model ID is part of the narration source hash

#### Scenario: Request playback
- **WHEN** authorized staff plays narration
- **THEN** the system returns a short-lived signed URL without making the narration bucket public
