## MODIFIED Requirements

### Requirement: Staff authentication
The system SHALL authenticate every Admin and Teacher through native Supabase Auth before granting protected staff application or REST access, while Learners continue to use scoped signed access links.

#### Scenario: Unauthenticated staff route
- **WHEN** a visitor requests an Admin or Teacher route without a valid Supabase Auth session
- **THEN** the system presents native Supabase sign-in/account-creation controls and returns no protected data

#### Scenario: Persistent native session
- **WHEN** a signed-in staff user reloads the application or the access token refreshes
- **THEN** the Supabase client restores or refreshes the session and authenticated REST/RLS requests continue with the native access token

#### Scenario: New account without role
- **WHEN** a visitor creates and confirms a Supabase Auth account without an active database staff grant
- **THEN** the system links the domain profile but denies Admin and Teacher workspaces with a clear no-role state

### Requirement: Domain profile synchronization
The system SHALL maintain one stable domain User linked by `auth_user_id` to the Supabase Auth identity.

#### Scenario: Auth account matches existing email
- **WHEN** a Supabase Auth account is created for an existing domain email
- **THEN** the provisioning trigger links that existing domain User without changing its domain UUID or creating a duplicate

#### Scenario: New Auth account
- **WHEN** a new Supabase Auth account has no matching domain email
- **THEN** the provisioning trigger creates one active domain User linked to that Auth identity

## ADDED Requirements

### Requirement: Native account actions
The system SHALL support email/password sign-in and account creation, magic-link sign-in, configured Google OAuth, and sign-out through Supabase Auth.

#### Scenario: Password signup requires confirmation
- **WHEN** Supabase accepts a signup but does not return an active session
- **THEN** the UI tells the user to confirm the account by email

#### Scenario: OAuth provider unavailable
- **WHEN** Google OAuth is not enabled or its redirect is rejected
- **THEN** the UI displays the Supabase error and does not grant fallback access

### Requirement: Database-owned staff authorization
The system SHALL derive Admin and Teacher permissions only from active database `staff_roles` linked to the current `auth.uid()`.

#### Scenario: User-editable metadata claims role
- **WHEN** an Auth user changes account metadata to claim Admin or Teacher
- **THEN** the application and database ignore that claim unless an active `staff_roles` grant exists
