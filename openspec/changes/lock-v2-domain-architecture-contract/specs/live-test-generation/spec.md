## ADDED Requirements

### Requirement: Server-side generation interfaces

The system SHALL expose small server-side generation interfaces for Test Item generation and narration generation while hiding 9Router provider details from browser callers.

#### Scenario: Browser requests item generation

- **WHEN** an Admin requests generated Test Item content from the web app
- **THEN** the browser calls the Chunks-LMS generation module and never receives 9Router API keys, provider credentials, or provider-specific request shapes

#### Scenario: Provider adapter changes

- **WHEN** the implementation swaps one 9Router model or TTS provider adapter for another
- **THEN** callers using `generateTestItem` or `generateNarration` keep the same module interface

### Requirement: Auditable generation jobs

The system SHALL record generation jobs with requester, target draft/package context, prompt/source hash, provider metadata safe for storage, status, retry/error information, and timestamps.

#### Scenario: TTS generation fails then retries

- **WHEN** a narration generation attempt fails and is retried
- **THEN** the generation job preserves the failed attempt information and the retry result without exposing secrets

### Requirement: Human approval before publish

The system SHALL require human approval before generated Test Item content or narration variants become part of a published Package Version.

#### Scenario: Generated narration pending review

- **WHEN** a TTS job succeeds for an item narration variant
- **THEN** the generated audio remains unavailable for published runtime selection until an authorized Admin approves it

### Requirement: Private audio storage

The system SHALL store generated or custom narration audio in private Storage and expose playback only through scoped, authorized access.

#### Scenario: Learner plays scoped audio

- **WHEN** a signed learner token is valid for a Learning Session using approved narration
- **THEN** the system grants access only to approved audio assets required by that scoped session
