## ADDED Requirements

### Requirement: Resource-agnostic questions
The system SHALL create Session Questions with an immutable internal identity, visible sequence, and optional external reference without requiring question content.

#### Scenario: Question without content
- **WHEN** a Teacher adds the next question without a resource reference
- **THEN** the system creates a valid Session Question with the next visible sequence

### Requirement: Optional planned question count
The system SHALL allow a Learning Session to define an optional planned question count while permitting sequential question creation during the session.

#### Scenario: Session has no planned total
- **WHEN** the Teacher selects Next Question in a session without a planned count
- **THEN** the system creates the next Session Question without requiring a total

### Requirement: Multiple learner attempts
The system SHALL permit one Assessment Attempt per eligible Learner for each Session Question.

#### Scenario: Three learners answer one question
- **WHEN** a Teacher records observations for three enrolled Learners on the same Session Question
- **THEN** the system stores three distinct Assessment Attempts linked to that question

### Requirement: Capture modes
The system SHALL support question-first and learner-first capture modes over the same Assessment Attempts.

#### Scenario: Switch capture mode
- **WHEN** a Teacher switches capture mode during an active Learning Session
- **THEN** existing Assessment Attempts remain unchanged and the UI resumes at the corresponding learner/question position

### Requirement: Closed-session capture
The system SHALL reject new Assessment Attempts after a Learning Session is completed.

#### Scenario: Capture after completion
- **WHEN** a Teacher attempts to add an assessment to a completed Learning Session
- **THEN** the system rejects the attempt and offers the correction workflow only for existing results
