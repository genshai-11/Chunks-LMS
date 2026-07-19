## ADDED Requirements

### Requirement: Session format
The system SHALL distinguish lesson Learning Sessions from test Learning Sessions without changing the existing session kind values `regular`, `pretest`, and `posttest`.

#### Scenario: Existing lesson session
- **WHEN** a Teacher starts a normal live observation
- **THEN** the Learning Session uses session format `lesson` and current live capture behavior is unchanged

#### Scenario: Test pretest session
- **WHEN** a Teacher starts a live-test baseline
- **THEN** the Learning Session uses session format `test` and session kind `pretest`

### Requirement: Prompt language for test sessions
The system SHALL store a prompt language for test Learning Sessions to choose Vietnamese or English prompt content.

#### Scenario: Vietnamese prompt language
- **WHEN** a Teacher starts a test session with prompt language Vietnamese
- **THEN** the session uses `Complete Sentence (Vie)` for item display and audio

#### Scenario: English prompt language
- **WHEN** a Teacher starts a test session with prompt language English
- **THEN** the session uses `Complete Sentence (Eng)` for item display and audio
