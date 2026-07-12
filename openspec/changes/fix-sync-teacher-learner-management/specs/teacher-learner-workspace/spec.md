## ADDED Requirements

### Requirement: Teacher learner workspace

The system SHALL show Learners for the selected assigned Class with avatar, attendance, finalized sample size, RFC/RAC, recent trend, and live-session state.

#### Scenario: Select learner

- **WHEN** a Teacher selects a Learner in the active Class
- **THEN** the system shows that Learner's visual profile and learner-scoped actions

### Requirement: Learner-first session entry

The system SHALL allow a Teacher to start or resume the selected Class Learning Session with the selected Learner first in the round-robin observation order.

#### Scenario: Start with selected learner

- **WHEN** a Teacher chooses Start session for a selected Learner
- **THEN** the Learning Session remains Class-scoped and the selected Learner receives the first Session Question assignment

### Requirement: Teacher class lifecycle

The system SHALL allow a Teacher to create and update authorized Classes and SHALL preserve history when ending a Class.

#### Scenario: End class with history

- **WHEN** a Teacher ends a Class that has Learning Sessions
- **THEN** the Class becomes ended and no attendance, attempt, event, snapshot, or report history is deleted
