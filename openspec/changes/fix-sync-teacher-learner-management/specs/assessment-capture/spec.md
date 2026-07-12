## ADDED Requirements

### Requirement: Neutral probe controls

The system SHALL present three visually neutral probe actions labeled Fail, Pass, and Done without red, yellow, or green fills or glow.

#### Scenario: Probe controls displayed

- **WHEN** an Assessment Attempt enters `probe_open`
- **THEN** Fail, Pass, and Done appear with equal neutral styling and accessible focus states

### Requirement: Probe label mapping

The system SHALL map Fail to `fail`, Pass to `continue`, and Done to `done` without changing stored event semantics.

#### Scenario: Pass continues probe

- **WHEN** the Teacher activates Pass
- **THEN** the system records `probe_continued` and keeps the attempt open
