## MODIFIED Requirements

### Requirement: Teacher-owned Class scope

The system SHALL derive Teacher access to Learners, Learning Sessions, and reports through Teacher-owned Classes and active Enrollments in the singleton Chunks Workspace.

#### Scenario: Teacher views learner in owned Class

- **WHEN** a Teacher requests a Learner who has an active Enrollment in one of the Teacher's Classes
- **THEN** the system permits the Teacher to view permitted Learner, session, attendance, and report data for that Class scope

#### Scenario: Teacher requests learner outside owned Classes

- **WHEN** a Teacher requests a Learner who is not enrolled in one of the Teacher's owned Classes
- **THEN** the system denies access at the database or server-module authorization layer

### Requirement: Admin package and measurement catalog ownership

The system SHALL let Admin manage Live Test Packages and CCI Profiles/Categories for the singleton Chunks Workspace without making Teacher course ownership into package ownership.

#### Scenario: Admin creates package draft

- **WHEN** an Admin creates a Live Test Package draft
- **THEN** the draft belongs to the Chunks Workspace and can be published for Teacher runtime selection after approval

#### Scenario: Teacher cannot mutate package catalog

- **WHEN** a Teacher attempts to change a published Package Version or CCI Profile
- **THEN** the system rejects the mutation while preserving Teacher read access to published package data needed for assigned Learning Sessions
