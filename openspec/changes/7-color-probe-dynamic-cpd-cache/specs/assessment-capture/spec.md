## ADDED Requirements

### Requirement: 7-Color Teacher Observe Dock Controls

The system SHALL render a primary 4-color dock (Red, Orange, Green, Purple) for provisional capture and a dedicated 3-color probe dock (Yellow Fail, Blue Continue, Indigo Done) when Green opens a probe.

#### Scenario: Observe initial color dock
- **WHEN** a Teacher observes an open question for a Learner
- **THEN** the UI presents primary color buttons for Red, Orange, Green, and Purple

#### Scenario: Observe probe dock
- **WHEN** a Teacher records Green
- **THEN** the UI transitions into the probe dock displaying Fail (Yellow), Continue (Blue), and Done (Indigo) buttons
