## ADDED Requirements

### Requirement: Test metadata reporting
The system SHALL allow finalized test results to be analyzed with their linked Test Item CVR, CCI, and CPD metadata.

#### Scenario: Test result with metadata
- **WHEN** a finalized Assessment Attempt links to a live-test item
- **THEN** reporting can show the result alongside that item's CVR, CCI, and derived CPD

### Requirement: Test reporting filters
The system SHALL support report filters for session format, session kind, prompt language, Test Resource, Test Block, and CVR/CCI/CPD bands.

#### Scenario: Filter to posttest English prompts
- **WHEN** a Teacher filters reports to test format, posttest kind, and English prompt language
- **THEN** only matching finalized test results appear in the report scope
