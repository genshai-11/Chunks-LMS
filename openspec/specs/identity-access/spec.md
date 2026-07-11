# identity-access Specification

## Purpose
TBD - created by archiving change establish-lms-foundation. Update Purpose after archive.
## Requirements
### Requirement: Clerk authentication
The system SHALL authenticate every Admin, Teacher, and Learner through Clerk before granting non-public application access.

#### Scenario: Unauthenticated access
- **WHEN** a visitor requests a protected application route without a valid Clerk session
- **THEN** the system redirects the visitor to authentication and returns no protected data

### Requirement: Organization-scoped authorization
The system SHALL isolate organization-owned data using Supabase Row Level Security evaluated from authenticated identity and database membership.

#### Scenario: Cross-organization request
- **WHEN** an authenticated user requests a row owned by another Organization
- **THEN** the database returns no row and rejects any attempted mutation

### Requirement: Role permissions
The system SHALL enforce Admin, Teacher, and Learner permissions at the database layer.

#### Scenario: Teacher accesses assigned class
- **WHEN** a Teacher requests a Class to which they are actively assigned
- **THEN** the system permits access to the Class and its enrolled Learners

#### Scenario: Learner accesses another learner
- **WHEN** a Learner requests another Learner's assessment or report data
- **THEN** the database denies access

### Requirement: Domain profile synchronization
The system SHALL maintain an idempotently synchronized domain User profile linked to the Clerk subject.

#### Scenario: Clerk webhook is delivered twice
- **WHEN** the same Clerk user synchronization event is processed more than once
- **THEN** the system retains one domain User and applies the latest valid profile state

