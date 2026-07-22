## ADDED Requirements

### Requirement: Separate standalone Test Results
The system SHALL provide a separate learner-profile Test Results surface containing only finalized or corrected standalone test data and SHALL leave existing Course/Class Analysis unchanged.

#### Scenario: Learner has completed standalone run
- **WHEN** an authorized viewer opens the Learner's Test Results tab
- **THEN** the system shows package/version, Session, CVR, CCI Name/Ampe, CPD, language, completion, finalized totals, correction state, and item provenance

#### Scenario: Learner has no standalone runs
- **WHEN** the Test Results tab opens for a Learner with no standalone data
- **THEN** the system displays a standalone empty state and no class-session rows

### Requirement: Reproducible standalone CPD
The system SHALL derive and display standalone item CPD and learner CPD score from the frozen session measurement and effective finalized/corrected result.

#### Scenario: Result correction changes effective learner CPD
- **WHEN** a standalone result is corrected
- **THEN** the report recomputes the effective learner CPD score while retaining package, measurement, original result, and correction provenance
