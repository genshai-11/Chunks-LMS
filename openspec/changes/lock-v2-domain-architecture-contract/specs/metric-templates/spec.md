## MODIFIED Requirements

### Requirement: Section-level target CVR and item-level measured CVR

The system SHALL store `target_cvr_ohm` as a Test Section measurement snapshot and SHALL store `measured_cvr = TC × LC × TL` as Test Item validation data.

#### Scenario: CSV target is imported

- **WHEN** the one-time `Chunks-resource - CVR_new.csv` import provides `Unit (Ohm)` for a section
- **THEN** the published Test Section snapshot stores that value as `target_cvr_ohm`

#### Scenario: Item validation is calculated

- **WHEN** a Test Item has TC 2, LC 3, and TL 4
- **THEN** the item validation data records `measured_cvr` as 24 without replacing the section `target_cvr_ohm`

### Requirement: CCI Profile snapshots

The system SHALL derive CCI for CPD from a CCI Profile/Category snapshot stored on the published Test Section or its immutable measurement snapshot.

#### Scenario: CCI category changes later

- **WHEN** an Admin changes a CCI Category in a draft or future profile version
- **THEN** already published Test Sections and historical reports keep using their original CCI snapshot

### Requirement: Canonical item CPD

The system SHALL derive item CPD as `target_cvr_ohm × CCI` and SHALL NOT require item CPD to be manually authored.

#### Scenario: Calculate item CPD

- **WHEN** a published Test Section has `target_cvr_ohm` 12 and its CCI snapshot value is 5
- **THEN** each item in that section uses item CPD 60 unless a later approved snapshot creates a new published version

### Requirement: Learner CPD score formula

The system SHALL derive Learner CPD Score as `item_cpd × finalized effective color score` using correction-effective final results.

#### Scenario: Corrected result changes learner CPD score

- **WHEN** a finalized Green result with color score 2 and item CPD 60 is corrected to Purple with color score 3
- **THEN** reports use Learner CPD Score 180 while preserving the original score as audit history
