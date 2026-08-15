## MODIFIED Requirements

### Requirement: Spectrum RFC and RAC
The system SHALL calculate spectrum RFC from warm measurement steps and RAC/%c from cool measurement steps over the actual measurement denominator `N_total`.

#### Scenario: Standard run with probes
- **WHEN** a standard 49-question run contains 3 probe steps
- **THEN** the spectrum denominator is `N_total = 52`

#### Scenario: Warm and cool colors
- **WHEN** a Report Window contains finalized spectrum measurement steps
- **THEN** RFC counts Red, Orange, and Yellow as warm colors, and RAC/%c counts Green, Blue, Indigo, and Purple as cool colors

### Requirement: Spectrum CPD factors
The system SHALL use normalized CPD color factors Red `0.00`, Orange `0.17`, Yellow `0.33`, Green `0.50`, Blue `0.67`, Indigo `0.83`, and Purple `1.00`, with Admin dynamic configuration where supported.

#### Scenario: CPD matrix uses spectrum factor
- **WHEN** CPD is calculated for an effective spectrum color
- **THEN** the color contribution uses that color's configured normalized factor
