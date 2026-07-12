## ADDED Requirements

### Requirement: Scoped Teacher class management

The system SHALL allow Teachers to manage only Classes assigned to them and SHALL enforce the same scope in Postgres authorization.

#### Scenario: Cross-teacher edit denied

- **WHEN** a Teacher attempts to update another Teacher's Class
- **THEN** the database denies the operation

### Requirement: Role-appropriate invitation links

The system SHALL provide Copy and mail invitation actions for managed people without requiring a transactional email backend.

#### Scenario: Admin invites teacher

- **WHEN** an Admin activates Send invite for a Teacher profile with an email
- **THEN** the system opens a prefilled mail message containing the staff sign-in URL
