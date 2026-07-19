## MODIFIED Requirements

### Requirement: Correction-aware learner CPD reporting

The system SHALL calculate Learner CPD reports from immutable item/section measurement snapshots joined to finalized or correction-effective Assessment Attempt results.

#### Scenario: Report uses correction-effective result

- **WHEN** a Report Window contains an Assessment Attempt whose Final Result was corrected with a valid replacement color
- **THEN** Learner CPD Score uses the effective corrected color score and report provenance still identifies the original and correction history

### Requirement: Measurement provenance in reports

The system SHALL display or expose the Package Version, Test Section snapshot, CCI Profile/Category snapshot, target CVR, item measured CVR, item CPD, sample size, and formula definition for CPD-related reports.

#### Scenario: Teacher opens CPD chart

- **WHEN** a Teacher opens a learner CPD chart for an assigned Class
- **THEN** the chart scope includes sample size and the immutable measurement provenance used for every displayed value

### Requirement: Learner scoped CPD access

The system SHALL allow signed learner access to read only the scoped Learner's own CPD report data and no other Learner's CPD observations.

#### Scenario: Learner token reads own CPD

- **WHEN** a Learner presents a valid token scoped to their learner record
- **THEN** the report returns only that Learner's CPD values for permitted windows and Classes

#### Scenario: Learner token requests another learner

- **WHEN** a Learner token is used to request another Learner's CPD values
- **THEN** the system denies the request and returns no protected rows
