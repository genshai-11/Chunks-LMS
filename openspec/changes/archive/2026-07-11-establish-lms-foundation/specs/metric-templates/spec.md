## ADDED Requirements

### Requirement: Immutable metric versions
The system SHALL calculate each metric using an immutable Metric Version defining population, filters, formula, window rules, null behavior, minimum sample, units, direction, and chart metadata.

#### Scenario: Formula changes
- **WHEN** an Admin changes a metric formula or semantic rule
- **THEN** the system creates a new Metric Version and retains the prior version

### Requirement: Finalized-result population
The system SHALL exclude unresolved and non-finalized Assessment Attempts from progress metrics.

#### Scenario: Open Green probe
- **WHEN** a Report Window contains an Assessment Attempt with an unresolved Green probe
- **THEN** that attempt contributes to neither numerator nor denominator of finalized-result metrics

### Requirement: RFC and RAC
The system SHALL calculate RFC as Red plus Yellow divided by finalized responses and RAC as Green plus Purple divided by finalized responses.

#### Scenario: One hundred finalized responses
- **WHEN** a window contains 27 Red-or-Yellow and 73 Green-or-Purple Final Results
- **THEN** RFC is 27 percent and RAC is 73 percent

### Requirement: V1 supporting metrics
The system SHALL provide Average Performance, Purple Mastery Rate, Clarification Rate, Clarification Depth, Awareness Recovery, and Focus Stability using the accepted definitions in the architecture context.

#### Scenario: No probed attempts
- **WHEN** a window has finalized responses but no Assessment Attempt entered the probe flow
- **THEN** Clarification Rate is zero while Clarification Depth and Awareness Recovery are null

### Requirement: Empty and insufficient windows
The system SHALL return null rather than zero when a metric denominator is empty and SHALL expose sample size and experimental status with every Metric Observation.

#### Scenario: Empty report window
- **WHEN** no finalized response exists in a Report Window
- **THEN** finalized-response averages and rates are null and charts display a gap
