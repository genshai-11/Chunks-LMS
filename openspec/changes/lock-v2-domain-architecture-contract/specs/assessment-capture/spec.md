## MODIFIED Requirements

### Requirement: Resource-agnostic questions with immutable item references

The system SHALL keep Session Questions internally identified and resource-agnostic while allowing test questions to reference immutable Test Item snapshots through `external_ref` or an equivalent immutable reference.

#### Scenario: Capture flexible test item

- **WHEN** the Teacher captures observation for the fifth Test Item in a selected published Test Section
- **THEN** the system creates or uses a Session Question with an immutable reference to that Test Item snapshot and stores the Assessment Attempt normally

#### Scenario: Package content changes later

- **WHEN** a later Package Version changes the text or measurement of an item with the same presentation order
- **THEN** existing Session Questions continue to resolve to the original immutable item snapshot selected by their Learning Session

### Requirement: Flexible test item count

The system SHALL create test Session Questions from the selected Test Section's item count rather than enforcing a fixed ten-item limit.

#### Scenario: Section has fewer than ten items

- **WHEN** a selected Test Section contains six Test Items
- **THEN** the observe flow stops after the sixth Test Item unless the Teacher starts another section or session

#### Scenario: Section has more than ten items

- **WHEN** a selected Test Section contains twelve Test Items
- **THEN** the observe flow can present all twelve ordered Test Items according to the selected Package Version
