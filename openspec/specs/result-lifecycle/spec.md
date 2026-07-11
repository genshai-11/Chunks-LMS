# result-lifecycle Specification

## Purpose
TBD - created by archiving change establish-lms-foundation. Update Purpose after archive.
## Requirements
### Requirement: Four-color result scale
The system SHALL represent Red, Yellow, Green, and Purple with operational values 0, 1, 2, and 3 respectively.

#### Scenario: Directly finalized color
- **WHEN** a Teacher records Red, Yellow, or Purple for an Assessment Attempt
- **THEN** the system records the provisional color and permits immediate finalization with the corresponding value

### Requirement: Green probe flow
The system SHALL keep a Green Provisional Result unresolved until a Probe Event produces Fail, Continue, or Done.

#### Scenario: Green then Fail
- **WHEN** a Teacher records Green and resolves the probe with Fail
- **THEN** the Final Result is Yellow and the Green and Fail history remains auditable

#### Scenario: Green then Done
- **WHEN** a Teacher records Green and resolves the probe with Done
- **THEN** the Final Result is Green and the probe history remains auditable

### Requirement: Probe limit
The system SHALL enforce a configurable positive maximum probe count with a default of two.

#### Scenario: Continue below maximum
- **WHEN** a Teacher selects Continue and the new count remains below the maximum
- **THEN** the system appends the Probe Event and presents the next probe

#### Scenario: Maximum reached
- **WHEN** the maximum probe count is reached without Done
- **THEN** the system requires an explicit Fail or Done and does not infer a result

### Requirement: Final-result immutability
The system SHALL preserve finalized result history and SHALL apply later changes only through a Correction containing actor, timestamp, reason, and replacement result.

#### Scenario: Correct closed-session result
- **WHEN** an authorized user corrects a Final Result with a reason
- **THEN** the original result remains auditable and the corrected result becomes effective for reporting

### Requirement: Atomic lifecycle update
The system SHALL append lifecycle history and update the current Assessment Attempt snapshot atomically.

#### Scenario: Snapshot update fails
- **WHEN** a lifecycle transaction cannot update its current snapshot
- **THEN** neither the event nor the partial snapshot change is committed

