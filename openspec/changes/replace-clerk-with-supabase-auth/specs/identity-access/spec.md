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

#### Scenario: Clerk webhook is delivered twice

- **WHEN** the same Supabase Auth provisioning event is processed more than once
- **THEN** the system retains one domain User and applies the latest valid profile state

## ADDED Requirements

### Requirement: Native account actions

The system SHALL support email/password sign-in and account creation, magic-link sign-in, and sign-out through Supabase Auth.

#### Scenario: Password signup requires confirmation

- **WHEN** Supabase accepts a signup but does not return an active session
- **THEN** the UI tells the user to confirm the account by email

### Requirement: Staff username login

The system SHALL permit Admin and Teacher password sign-in with either the Auth email or a unique normalized Staff Username without exposing the resolved email or treating the username as authorization.

#### Scenario: Valid active staff username

- **WHEN** an unauthenticated visitor submits a valid username and password linked to an active Admin or Teacher grant
- **THEN** the server authenticates the linked native Supabase Auth identity and the browser establishes the returned session

#### Scenario: Unknown, inactive, no-role, or wrong-password username

- **WHEN** username sign-in cannot authenticate an active database-granted staff account
- **THEN** the system returns one generic credential failure, follows the same database/Auth request shape, and reveals neither account existence nor email

#### Scenario: Repeated username login attempts

- **WHEN** one source exceeds the five-minute username-login attempt budget
- **THEN** the server rejects further attempts with a retry-later response while storing only HMAC bucket hashes, never raw IPs or usernames

### Requirement: Database-owned staff authorization

The system SHALL derive Admin and Teacher permissions only from active database `staff_roles` linked to the current `auth.uid()`.

#### Scenario: User-editable metadata claims role

- **WHEN** an Auth user changes account metadata to claim Admin or Teacher
- **THEN** the application and database ignore that claim unless an active `staff_roles` grant exists
