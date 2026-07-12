## ADDED Requirements

### Requirement: Teacher learner profile summary

The system SHALL calculate learner-profile indicators only from finalized results and SHALL display sample size with RFC/RAC.

#### Scenario: Learner has finalized results

- **WHEN** a Teacher opens the selected Learner profile
- **THEN** the system displays finalized sample size, RFC, RAC, and recent progress without including drafts or open probes

### Requirement: Learner-scoped report navigation

The system SHALL preserve selected Class and Learner context when navigating from Teacher learner profile to Analysis.

#### Scenario: Open learner report

- **WHEN** a Teacher selects View report for a Learner
- **THEN** Teacher Analysis opens filtered to that Class and Learner
