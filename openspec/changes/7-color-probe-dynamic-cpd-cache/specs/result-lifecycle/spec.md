## MODIFIED Requirements

### Requirement: Four-color result scale

The system SHALL support a 7-color result spectrum: Red, Orange, Yellow, Green, Blue, Indigo, and Purple, categorizing Red, Orange, Yellow as Warm/Struggle colors, and Green, Blue, Indigo, Purple as Cool/Achievement colors.

#### Scenario: Directly finalized color
- **WHEN** a Teacher records Red, Orange, or Purple for an Assessment Attempt
- **THEN** the system records the provisional color and immediately finalizes with a single-element color history

### Requirement: Green probe flow

The system SHALL keep a Green Provisional Result unresolved until resolved with Fail (recording Yellow), Continue (recording Blue), or Done (recording Indigo).

#### Scenario: Green then Fail
- **WHEN** a Teacher records Green and resolves the probe with Fail
- **THEN** the Final Result is Yellow, recordedColors includes Green followed by Yellow, and the history remains auditable

#### Scenario: Green then Done
- **WHEN** a Teacher records Green and resolves the probe with Done
- **THEN** the Final Result is Indigo, recordedColors includes Green followed by Indigo, and the probe history remains auditable

#### Scenario: Green then Continue and Done
- **WHEN** a Teacher records Green, continues one or more times, and finishes with Done
- **THEN** recordedColors captures Green, every intermediate Blue step, and final Indigo, with full sequence preserved for metrics

## ADDED Requirements

### Requirement: Multi-color probe sequence preservation

The system SHALL preserve the complete ordered list of recorded colors (`recordedColors: ResultColor[]`) across the lifetime of each Assessment Attempt.

#### Scenario: Probe sequence with multiple continues
- **WHEN** a Teacher records Green, executes two Continue steps, and concludes with Done
- **THEN** `recordedColors` preserves exactly `['green', 'blue', 'blue', 'indigo']` with an effective length of 4
