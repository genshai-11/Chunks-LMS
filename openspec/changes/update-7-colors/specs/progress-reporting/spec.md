## ADDED Requirements

### Requirement: Effective spectrum heatmap
The system SHALL display the effective spectrum color for each measured cell and show probe depth with a `+n` badge when probe history exists.

#### Scenario: Probe Fail heatmap cell
- **WHEN** an attempt enters Green probe flow and resolves with Fail after one probe step
- **THEN** the heatmap cell displays Yellow with a `+1` badge

#### Scenario: Probe Done heatmap cell
- **WHEN** an attempt enters Green probe flow and resolves with Done after one or more probe steps
- **THEN** the heatmap cell displays Indigo with the corresponding `+n` badge
