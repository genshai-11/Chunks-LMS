## ADDED Requirements

### Requirement: Course management
The system SHALL allow an Admin to create and manage Courses within an Organization.

#### Scenario: Admin creates first course
- **WHEN** an Admin creates `ERE-Level-B` with valid dates and active status
- **THEN** the Course becomes available for Class creation in that Organization

### Requirement: One-teacher class
The system SHALL assign exactly one active Teacher to each active Class in V1.

#### Scenario: Second teacher assignment
- **WHEN** an Admin attempts to add a second active Teacher to an active Class
- **THEN** the system rejects the assignment without altering the existing Teacher

### Requirement: Configurable class capacity
The system SHALL enforce a configurable positive Learner capacity per Class with a default value of three.

#### Scenario: Enrollment exceeds capacity
- **WHEN** an Admin enrolls a Learner into a full Class
- **THEN** the system rejects the Enrollment and reports the configured capacity

### Requirement: Enrollment lifecycle
The system SHALL preserve Enrollment start, end, and status independently from the Learner profile.

#### Scenario: Learner leaves a class
- **WHEN** an Admin ends an active Enrollment
- **THEN** historical sessions and results remain associated with the Learner and Class while future participation stops
