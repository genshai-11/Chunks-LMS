## ADDED Requirements

### Requirement: Live-test resources
The system SHALL allow a test Learning Session to use a selected Test Resource block containing ten ordered Test Items.

#### Scenario: Start test block
- **WHEN** a Teacher selects a Test Resource and block for a live-test session
- **THEN** the observe flow presents the block's ten Test Items in order

### Requirement: Resource-linked Session Questions
The system SHALL create resource-agnostic Session Questions for Test Items by storing the Test Item reference in `external_ref`.

#### Scenario: Capture test item
- **WHEN** the Teacher captures observation for Test Item 1
- **THEN** the system creates a Session Question with `external_ref` referencing that Test Item and stores the Assessment Attempt normally

### Requirement: Ten-item test limit
The system SHALL prevent pretest/posttest live-test sessions from adding ad-hoc items beyond the selected block's ten Test Items.

#### Scenario: End of test block
- **WHEN** the Teacher reaches Number 10 in a pretest live-test session
- **THEN** the observe flow stops creating new Test Item questions for that block
