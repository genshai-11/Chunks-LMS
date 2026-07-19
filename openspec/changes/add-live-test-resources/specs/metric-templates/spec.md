## ADDED Requirements

### Requirement: CVR and CCI source measurements
The system SHALL store CVR and CCI measurement values and labels for each live-test item so derived demand can be reproduced.

#### Scenario: Imported test item
- **WHEN** a Test Item is imported from the resource CSV
- **THEN** the item stores CVR metadata and CCI metadata separately

### Requirement: Derived CPD
The system SHALL derive CPD from CVR multiplied by CCI and SHALL NOT require CPD to be manually authored.

#### Scenario: Recalculate CPD
- **WHEN** a Test Item has CVR 12 and CCI 5
- **THEN** the derived CPD is 60
