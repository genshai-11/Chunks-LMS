## MODIFIED Requirements

### Requirement: Supabase Auth staff authentication

The system SHALL authenticate Admin and Teacher staff through native Supabase Auth before granting staff application access, and SHALL NOT require Learner Supabase Auth accounts in this version.

#### Scenario: Staff access with Supabase Auth

- **WHEN** an Admin or Teacher requests a protected staff route with a valid Supabase Auth session
- **THEN** the system resolves a domain User and active staff role before returning protected staff data

#### Scenario: Learner has no staff Auth account

- **WHEN** a Learner uses learner access for their dashboard
- **THEN** the system does not require or create a Supabase Auth user for that Learner

### Requirement: Singleton Chunks Workspace authorization

The system SHALL treat the Chunks Workspace as the singleton administrative scope while enforcing Admin and Teacher permissions at the database and server-module layer.

#### Scenario: Admin sees workspace data

- **WHEN** an active Admin requests workspace roster, package, measurement, or report data
- **THEN** the system permits access according to Admin policies within the singleton Chunks Workspace

#### Scenario: Teacher is scoped through Classes

- **WHEN** an active Teacher requests Class, Learner, session, or report data
- **THEN** the system permits only rows reachable through that Teacher's owned Classes and active Enrollments

### Requirement: Signed learner access

The system SHALL provide Learner read access through revocable, expiring signed learner tokens whose raw token value is never stored.

#### Scenario: Valid learner token

- **WHEN** a Learner presents an unexpired, unrevoked signed learner token for their Learner scope
- **THEN** the system returns only that Learner's permitted progress, attendance, schedule, and finalized/corrected reports

#### Scenario: Expired learner token

- **WHEN** a Learner presents an expired signed learner token
- **THEN** the system denies access and returns no protected Learner rows

#### Scenario: Revoked learner token

- **WHEN** a Learner presents a revoked signed learner token
- **THEN** the system denies access and returns no protected Learner rows

### Requirement: Database-owned authorization data

The system SHALL base staff authorization on database-owned roles and relationships rather than user-editable Auth metadata.

#### Scenario: User metadata changes

- **WHEN** a user-editable metadata claim changes in the Auth profile
- **THEN** RLS and server authorization decisions remain based on database-owned role and Class/Enrollment relationships
