## ADDED Requirements

### Requirement: Admin resource management workspace

The system SHALL provide an Admin-only resource management workspace for Live Test CVR, CCI, and Session catalog entries used to prepare test Learning Sessions.

#### Scenario: Admin loads resource catalogs

- **WHEN** an authorized Admin opens the resource management workspace
- **THEN** the system loads CVR item data, CCI Profiles/Categories, Test Packages, Package Versions, Test Sections, and resource readiness metadata without loading unrelated content-authoring resources

#### Scenario: Non-admin cannot manage resources

- **WHEN** a Teacher or Learner attempts to open or mutate Admin resource catalogs
- **THEN** the system denies the management action through staff role/RLS boundaries and does not rely on UI hiding alone

### Requirement: Guarded draft resource edits

The system SHALL allow Admins to edit CVR, CCI, and Session catalog metadata only when the target record is draft-scoped or otherwise not immutable/history-linked.

#### Scenario: Edit draft Test Item CVR fields

- **WHEN** an Admin edits TC, LC, TL, or prompt metadata for a Test Item in a draft Package Version
- **THEN** the system saves the draft metadata and continues to derive measured CVR from the catalog/domain helper rather than duplicating scoring rules in the UI

#### Scenario: Attempt to edit a published Package Version item

- **WHEN** an Admin attempts to edit a Test Item that belongs to a published Package Version
- **THEN** the system blocks the in-place edit and directs the Admin to create a new draft/version or use an approved override path

### Requirement: Guarded resource deletion and archive fallback

The system SHALL prevent destructive deletion of resource records that are published, linked to Learning Sessions, or referenced by section measurement snapshots/history.

#### Scenario: Delete draft unlinked section

- **WHEN** an Admin confirms deletion of a draft Test Section that has no Learning Session, Session Question, or published snapshot dependency
- **THEN** the system deletes the draft resource row and refreshes the resource management view

#### Scenario: Published or history-linked resource deletion requested

- **WHEN** an Admin requests deletion of a published Package Version, active CCI category, historical Test Section, or resource linked to a Learning Session
- **THEN** the system refuses destructive deletion and offers archive, supersede, or create-new-version guidance instead

### Requirement: Compact Live Tests workflow layout

The system SHALL present Admin Live Tests workflows with a compact shared package/version/section selector and responsive focused panels.

#### Scenario: Switch Live Tests workflows

- **WHEN** an Admin switches between package workflow, CVR generation, narration review, CSV import, and legacy read-only workflows
- **THEN** the selected package/version/section context remains visible and reusable without repeating full selector panels in each workflow

#### Scenario: Narrow viewport layout

- **WHEN** the Admin Live Tests page is displayed on a narrow viewport
- **THEN** filters and workflow panels stack without hiding primary actions or requiring horizontal page scrolling outside data tables
