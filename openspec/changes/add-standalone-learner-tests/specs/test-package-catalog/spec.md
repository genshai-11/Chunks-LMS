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
