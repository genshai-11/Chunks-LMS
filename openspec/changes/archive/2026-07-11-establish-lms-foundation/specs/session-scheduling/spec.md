## ADDED Requirements

### Requirement: Scheduled sessions
The system SHALL allow an authorized Admin or assigned Teacher to schedule one-time or weekly Class sessions with timezone, start time, and duration.

#### Scenario: Weekly schedule
- **WHEN** an authorized user creates a weekly schedule within a Course date range
- **THEN** the system materializes identifiable Scheduled Session occurrences for that range

### Requirement: Actual learning session
The system SHALL distinguish a Scheduled Session from the actual Learning Session used for attendance and assessment.

#### Scenario: Start scheduled session
- **WHEN** the assigned Teacher starts a Scheduled Session
- **THEN** the system creates or opens its associated Learning Session without changing the planned start time

### Requirement: Schedule status
The system SHALL support scheduled, completed, cancelled, and rescheduled session outcomes without deleting original schedule history.

#### Scenario: Reschedule a session
- **WHEN** an authorized user reschedules a future occurrence
- **THEN** the original occurrence records that it was rescheduled and the replacement occurrence links back to it

### Requirement: Attendance
The system SHALL record Present, Late, Absent, or Excused attendance for each expected Learner in a Learning Session.

#### Scenario: Complete session attendance
- **WHEN** a Teacher completes a Learning Session
- **THEN** every enrolled expected Learner has an explicit attendance outcome
