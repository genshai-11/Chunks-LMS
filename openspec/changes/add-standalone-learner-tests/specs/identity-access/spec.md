## ADDED Requirements

### Requirement: Standalone test authorization
The system SHALL authorize standalone test data by authenticated role, Organization, and Learner ownership without requiring Class enrollment.

#### Scenario: Teacher tests same-organization learner
- **WHEN** an authenticated Teacher creates or resumes a run for an active Learner in the same Organization
- **THEN** the database permits the operation without a Class relationship

#### Scenario: Cross-organization standalone access
- **WHEN** a Teacher requests a standalone assignment, run, or result owned by another Organization
- **THEN** the database returns no row and rejects mutation

#### Scenario: Learner reads another learner test
- **WHEN** a Learner requests another Learner's standalone Test Results
- **THEN** the database denies access
