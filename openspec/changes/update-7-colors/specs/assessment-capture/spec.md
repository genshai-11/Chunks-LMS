## ADDED Requirements

### Requirement: Spectrum primary dock
The capture interface SHALL always display a primary dock with four large buttons labeled `0 · Red`, `1 · Orange`, `2 · Green`, and `3 · Purple`.

#### Scenario: Teacher uses primary shortcuts
- **WHEN** a Teacher presses `0`, `1`, `2`, or `3` during active capture
- **THEN** the system records the corresponding primary action Red, Orange, Green, or Purple

#### Scenario: Teacher selects Green
- **WHEN** a Teacher clicks `2 · Green` or presses `2`
- **THEN** the interface immediately opens the Probe Flow dock for the active learner/question cell

### Requirement: Spectrum probe dock
The Probe Flow dock SHALL display Yellow (Fail), Blue (Continue), and Indigo (Done) actions with keyboard shortcuts `F/1`, `C/2`, and `D/3/Enter` respectively.

#### Scenario: Teacher uses probe shortcuts
- **WHEN** the Probe Flow dock is open and the Teacher presses `F`, `1`, `C`, `2`, `D`, `3`, or `Enter`
- **THEN** the system records the matching probe action without requiring pointer input

### Requirement: Optimistic capture feedback
The capture interface SHALL update the active cell and probe dock state optimistically after a valid button or keyboard action.

#### Scenario: Capture click succeeds
- **WHEN** the Teacher records a color or probe action and the server write succeeds
- **THEN** the UI keeps the optimistic state and advances without refetching all sessions

#### Scenario: Capture click fails
- **WHEN** the Teacher records a color or probe action and the server write fails
- **THEN** the UI shows a recoverable error and reconciles the active cell without losing the Teacher's context
