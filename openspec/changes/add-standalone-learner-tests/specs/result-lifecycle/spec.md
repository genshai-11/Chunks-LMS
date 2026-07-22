## ADDED Requirements

### Requirement: Standalone test result lifecycle
The system SHALL apply the accepted four-color, Green probe, probe limit, finalization, and correction invariants to standalone Test Item attempts through a separate persistent aggregate.

#### Scenario: Standalone Green then Done
- **WHEN** a Teacher records Green for a standalone Test Item and resolves the probe with Done
- **THEN** the effective result is finalized Green and all provisional/probe history remains auditable

#### Scenario: Standalone correction
- **WHEN** an authorized actor corrects a finalized standalone result with a reason
- **THEN** the original result remains auditable and the correction becomes effective for standalone Test Results

### Requirement: Atomic standalone lifecycle update
The system SHALL append a standalone lifecycle event and update its current attempt snapshot atomically.

#### Scenario: Standalone snapshot update fails
- **WHEN** a standalone lifecycle transaction cannot update its current snapshot
- **THEN** neither the event nor a partial snapshot change is committed
