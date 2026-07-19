## ADDED Requirements

### Requirement: Admin-only resource management access

The system SHALL restrict resource management views and mutations for CVR, CCI, and Live Test Session catalogs to authorized Admin staff.

#### Scenario: Admin manages resource catalogs

- **WHEN** a signed-in staff User has an active Admin role grant
- **THEN** the User can load the Admin resource management workspace and request eligible draft catalog mutations

#### Scenario: Teacher access denied for resource mutation

- **WHEN** a signed-in Teacher attempts to mutate CVR, CCI, or Live Test Session catalog records through the Admin resource management path
- **THEN** the system denies the action through authorization/RLS checks and preserves the resource record unchanged
