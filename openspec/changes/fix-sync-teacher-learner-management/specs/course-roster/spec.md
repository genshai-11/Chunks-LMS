## ADDED Requirements

### Requirement: Scoped Teacher class management

The system SHALL allow Teachers to manage only Classes assigned to them and SHALL enforce the same scope in Postgres authorization.

#### Scenario: Cross-teacher edit denied

- **WHEN** a Teacher attempts to update another Teacher's Class
- **THEN** the database denies the operation

#### Scenario: Assigned class remains visible

- **WHEN** a Teacher loads the Class workspace
- **THEN** Postgres returns the Course containing each assigned Class and the client retains those Classes in the Teacher scope

### Requirement: Teacher-owned learner enrollment

The system SHALL let a Teacher create or reuse a profile-only Learner and enroll that Learner in an active assigned Class through one atomic database command.

#### Scenario: Teacher creates learner in assigned class

- **WHEN** a Teacher submits a valid Learner for an active Class assigned to that Teacher
- **THEN** the system creates the profile, organization membership, and enrollment atomically while enforcing capacity and multi-class rules

#### Scenario: Teacher targets another Teacher's class

- **WHEN** a Teacher attempts learner creation for a Class assigned to someone else
- **THEN** the database denies the command and creates no partial profile or enrollment

### Requirement: Role-appropriate invitation links

The system SHALL provide Copy and mail invitation actions for managed people without requiring a transactional email backend.

#### Scenario: Admin invites teacher

- **WHEN** an Admin activates Send invite for a Teacher profile with an email
- **THEN** the system opens a prefilled mail message containing the staff sign-in URL
