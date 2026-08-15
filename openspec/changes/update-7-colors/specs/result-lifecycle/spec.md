## MODIFIED Requirements

### Requirement: Seven-color spectrum result scale
The system SHALL represent the official measurement spectrum as Red, Orange, Yellow, Green, Blue, Indigo, and Purple with normalized CPD factors from 0.00 to 1.00.

#### Scenario: Direct primary color
- **WHEN** a Teacher records Red, Orange, or Purple from the primary capture dock
- **THEN** the system records the provisional color and permits immediate finalization with the same effective spectrum color

#### Scenario: Green enters probe flow
- **WHEN** a Teacher records Green from the primary capture dock
- **THEN** the system records Green as the probe-entry state and immediately presents the Probe Flow dock

### Requirement: Green probe flow
The system SHALL keep a Green probe-entry result unresolved until a Probe Event produces Fail, Continue, or Done according to the 7-color spectrum rules.

#### Scenario: Green then Fail
- **WHEN** a Teacher records Green and resolves the probe with Fail
- **THEN** the Final Result effective color is Yellow and the Green and Fail history remains auditable

#### Scenario: Green then Continue
- **WHEN** a Teacher records Green and selects Continue while another probe is allowed
- **THEN** the system records a Blue probe step, increments probe depth, and keeps the probe flow open

#### Scenario: Green then Done
- **WHEN** a Teacher records Green and resolves the probe with Done
- **THEN** the Final Result effective color is Indigo and the probe history remains auditable
