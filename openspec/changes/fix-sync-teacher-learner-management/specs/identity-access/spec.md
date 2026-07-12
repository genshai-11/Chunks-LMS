## ADDED Requirements

### Requirement: Clerk-scoped cloud workspace

The system SHALL authenticate Supabase REST and Realtime with the current Clerk session and SHALL load only organizations linked to that Clerk subject.

#### Scenario: Same account in two browsers

- **WHEN** the same Clerk account opens the application in two browser contexts
- **THEN** both contexts load the same cloud organization and neither selects a demo workspace by richness

### Requirement: Actionable sync diagnostics

The system SHALL identify whether synchronization failed during authentication, provisioning, loading, writing, settings, or realtime setup without exposing credentials.

#### Scenario: Provisioning failure

- **WHEN** organization provisioning fails
- **THEN** the UI reports the provisioning phase and safe database message

### Requirement: Staff role landing

The system SHALL route signed-in staff directly to an authorized workspace and SHALL not show a shared role portal to Teacher-only users.

#### Scenario: Teacher signs in

- **WHEN** a Teacher-only account signs in
- **THEN** the account lands at `/teacher` and cannot open Admin routes

#### Scenario: Configured Admin signs in

- **WHEN** `le.ntmkh@gmail.com` signs in
- **THEN** the account can access Admin and Teacher capabilities
