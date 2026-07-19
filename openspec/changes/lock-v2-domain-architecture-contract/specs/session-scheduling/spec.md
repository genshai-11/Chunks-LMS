## MODIFIED Requirements

### Requirement: Flexible test section selection

The system SHALL allow a test Learning Session to select an immutable published Package Version and one Test Section with a flexible number of ordered Test Items.

#### Scenario: Start flexible section test

- **WHEN** a Teacher starts a test Learning Session from a published Package Version and Test Section containing twelve Test Items
- **THEN** the Learning Session stores the selected immutable Package Version and Test Section and the observe flow plans twelve ordered Test Item prompts

#### Scenario: Existing lesson session remains lesson

- **WHEN** a Teacher starts a normal live observation without a Package Version
- **THEN** the Learning Session uses lesson format and stores no package or section selection

### Requirement: Immutable session package reference

The system SHALL preserve the Package Version and Test Section snapshot selected by a Learning Session even if a later draft or version changes.

#### Scenario: Package version changes after session

- **WHEN** an Admin publishes a new Package Version after a Learning Session used an earlier published version
- **THEN** the existing Learning Session and its reports continue to resolve against the earlier immutable version and section snapshot

### Requirement: Independent narration settings

The system SHALL allow test Learning Sessions to resolve approved intro narration and item narration independently by language and voice.

#### Scenario: Different intro and item voices

- **WHEN** a Teacher runs a test section with Vietnamese intro voice A and English item voice B configured in the selected package version
- **THEN** intro playback uses the approved intro narration variant and item playback uses the approved item narration variants without changing Test Item identity
