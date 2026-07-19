## ADDED Requirements

### Requirement: One-Learner assignment
The system SHALL assign one active Learner to one published Test Package without requiring a Class or Enrollment.

#### Scenario: Learner has no class
- **WHEN** a Teacher selects an active same-organization Learner with no Class
- **THEN** the system permits a standalone test assignment and creates no Class or Enrollment

### Requirement: Immutable run setup
The system SHALL snapshot package version, Test Section measurement, prompt language, voice, approved narration, and ordered Test Items before a run starts.

#### Scenario: Start audio-ready session
- **WHEN** setup has one approved current introduction and ten approved current item narrations
- **THEN** the system freezes the run inputs and starts an isolated one-Learner run

### Requirement: Session introduction and item prompts
The system SHALL present and read Session number, CVR, CCI Ampe, and CCI Name before presenting ordered complete sentences in the selected language.

#### Scenario: Vietnamese run
- **WHEN** Vietnamese is selected
- **THEN** the introduction metadata and all ten Vietnamese complete sentences use their approved Vietnamese narration

### Requirement: Isolated runtime state
The system SHALL keep standalone routes, runtime state, persistence, and results separate from live class sessions.

#### Scenario: Live session is open concurrently
- **WHEN** a standalone run proceeds while a live class session is open
- **THEN** neither workflow changes the other’s participants, questions, results, or completion state

### Requirement: Resume and completion
The system SHALL resume an in-progress run and SHALL complete it only after all ordered items have finalized or corrected results.

#### Scenario: Browser closes mid-run
- **WHEN** the Teacher reopens an in-progress standalone run
- **THEN** the system restores the same frozen items/settings and resumes at incomplete work
