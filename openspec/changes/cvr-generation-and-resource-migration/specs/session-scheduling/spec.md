## ADDED Requirements

### Requirement: Original Vocab & Sentences Migration
The system SHALL seed the V2 test tables with original vocabulary terms and pre-created sentences from the source CSV, mapping the target CVR directly to the Unit (Ohm) column values.

#### Scenario: Verify seeded sessions
- **GIVEN** the database migration is applied
- **WHEN** querying the seeded test packages and versions
- **THEN** it returns 8 sessions (blocks) with target CVR Ohm values matching the respective session's Unit (Ohm) column (3, 5, 7, 9, 11, 13, 15, 17)

### Requirement: CVR complexity equation validation
The system SHALL validate that for all imported items, their target CVR is set to their Unit (Ohm) value.

#### Scenario: Verify CVR value on imported item
- **GIVEN** an item from Session 1 is imported
- **WHEN** inspecting the CVR value of the item in the database
- **THEN** the CVR value equals 3
