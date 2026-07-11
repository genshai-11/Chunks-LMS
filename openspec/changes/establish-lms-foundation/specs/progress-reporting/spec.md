## ADDED Requirements

### Requirement: Course-level progress
The system SHALL provide each authorized viewer with Learner progress aggregated over the selected Course.

#### Scenario: Teacher views learner course report
- **WHEN** the assigned Teacher opens a Learner's Course report
- **THEN** the system displays permitted Metric Observations, sample sizes, attendance, and session history for that Course

### Requirement: Dynamic report windows
The system SHALL support session, week, month, and custom-date Report Windows.

#### Scenario: Custom window
- **WHEN** a user selects valid custom start and end dates
- **THEN** all displayed metrics and charts use only effective results within that window

### Requirement: Period comparison
The system SHALL compare a selected Report Window with the immediately preceding equal-duration window using the same filters and Metric Version.

#### Scenario: Empty prior window
- **WHEN** the preceding comparison window has no valid denominator
- **THEN** the report displays no trend rather than a zero or infinite change

### Requirement: Learner self-access
The system SHALL provide a Learner a read-only dashboard containing only their own permitted progress, schedule, and attendance.

#### Scenario: Learner dashboard
- **WHEN** an authenticated Learner opens the dashboard
- **THEN** the system shows only that Learner's authorized Courses, sessions, attendance, and progress

### Requirement: Operational interpretation
The system SHALL identify experimental metrics and SHALL display definitions and sample sizes without presenting them as validated psychometric judgments.

#### Scenario: Experimental metric card
- **WHEN** Focus Stability is displayed
- **THEN** the report marks it experimental and provides its definition and sample size
