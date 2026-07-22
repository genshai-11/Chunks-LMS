# Feature Specification: Standalone Learner Tests

**Feature Branch**: `feat/standalone-learner-tests`

**Created**: 2026-07-19

**Status**: Draft

**Input**: Replace obsolete test/resource data with the attached Chunks Resource workbook as the canonical source, use the correct session CVR and CCI Ampe values, provide resource/audio management, run one-to-one tests outside live classes, and show results in a separate learner-profile tab.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Replace Obsolete Test Data (Priority: P1)

As an Admin, I can preview the canonical workbook, see all validation findings and the exact obsolete test-only rows that will be removed, then replace the obsolete test catalog with a reviewed canonical package.

**Why this priority**: Every runtime and result depends on correct session CVR, named CCI, Ampe, prompts, and item ordering.

**Independent Test**: Load the canonical workbook and verify a preview containing one package, eight sessions, 80 items, correct CVR values, correct named CCI/Ampe values, the Session 1 Item 10 mismatch warning, and exact deletion impact counts before replacement is allowed.

**Acceptance Scenarios**:

1. **Given** obsolete test/resource imports exist, **When** an Admin previews replacement, **Then** the system lists only test/resource rows and dependent test-only history that will be removed and excludes accounts, learners, classes, enrollments, and non-test sessions.
2. **Given** the workbook passes structural validation and the Admin gives final destructive confirmation, **When** replacement runs, **Then** obsolete test data is removed and exactly one canonical draft package with eight sessions and 80 ordered items is created.
3. **Given** a workbook item references a different CCI from its session mapping, **When** preview runs, **Then** the mismatch is displayed and preserved as source metadata rather than silently normalized.
4. **Given** replacement fails after it begins, **When** the operation ends, **Then** either the prior test data remains intact or the approved restore path can recreate it.

---

### User Story 2 - Manage Canonical Test Resources (Priority: P2)

As an Admin, I can review and manage draft package sessions, test items, CVR values, CCI names/Ampe values, computed CPD, and publication readiness without changing published history in place.

**Why this priority**: Teachers need a trusted, immutable package before a standalone test can start.

**Independent Test**: Review all eight sessions, verify their CVR/CCI/CPD and item counts, publish the canonical version, and confirm that later changes require a new draft/version or superseding measurement snapshot.

**Acceptance Scenarios**:

1. **Given** the canonical draft, **When** the Admin reviews each session, **Then** Session 1–8 show CVR `3,5,7,9,11,13,15,17`, CCI Ampe `2,2,4,4,6,6,8,8`, and the workbook CCI names.
2. **Given** a published package version, **When** a user attempts an in-place edit or delete, **Then** the action is rejected and version/supersede guidance is shown.
3. **Given** a session has ten complete bilingual items and valid measurements, **When** readiness is calculated, **Then** content and CPD readiness are marked complete independently from audio readiness.

---

### User Story 3 - Prepare and Approve Test Audio (Priority: P3)

As an Admin, I can generate, review, reject, regenerate, and approve Vietnamese or English narration for each session introduction and item before teachers use it.

**Why this priority**: The test must read session metadata and complete sentences consistently, but unreviewed generated audio must never be used automatically.

**Independent Test**: Generate one session introduction and ten item narrations in one language, approve them, and verify the session becomes ready only for that language and selected voice.

**Acceptance Scenarios**:

1. **Given** a canonical session, **When** introduction narration is generated, **Then** its source text includes session number, CVR, CCI Ampe, and CCI Name.
2. **Given** an item narration request, **When** narration is generated, **Then** it uses the complete sentence in the selected language.
3. **Given** generated but unapproved audio, **When** a Teacher prepares a run, **Then** the run remains blocked for that language/voice.
4. **Given** approved audio whose source text no longer matches the draft, **When** readiness is checked, **Then** it is marked stale and cannot start a new run.

---

### User Story 4 - Run a Standalone One-to-One Test (Priority: P4)

As a Teacher, I can select exactly one active Learner and run one package session without creating or selecting a Class.

**Why this priority**: This is the core new workflow and must not affect current live class observation.

**Independent Test**: Select a learner with no class, select one published package session and an audio-ready language/voice, complete all ten items, and verify no Class, Enrollment, or live Learning Session is created or changed.

**Acceptance Scenarios**:

1. **Given** active learners exist, **When** the Teacher starts setup, **Then** exactly one learner can be selected regardless of class enrollment.
2. **Given** a package session and approved audio, **When** setup opens, **Then** it displays and reads Session number, CVR, CCI Ampe, and CCI Name before item prompts.
3. **Given** Vietnamese is selected, **When** the run proceeds, **Then** Vietnamese complete sentences and their approved narration are used; English behaves equivalently.
4. **Given** results and probe actions are recorded, **When** the run completes, **Then** finalized results and corrections are retained with package, measurement, language, voice, and item provenance.
5. **Given** a live class session is open, **When** a standalone test runs, **Then** neither workflow changes the other’s route, state, participants, or results.

---

### User Story 5 - View Separate Test Results (Priority: P5)

As a Teacher reviewing a Learner profile, I can open a separate Test Results tab and see standalone package/session results and CPD provenance without mixing them into existing class/session Analysis.

**Why this priority**: Standalone CPD values vary by session and require a dedicated, understandable history.

**Independent Test**: Open a learner with one completed standalone run and verify the Test Results tab shows package/version, session, CVR, CCI name/Ampe, CPD, language, finalized result totals, correction state, and item detail while the existing Analysis view is unchanged.

**Acceptance Scenarios**:

1. **Given** no standalone runs, **When** Test Results opens, **Then** it shows a clear empty state without class/session results.
2. **Given** completed standalone runs, **When** Test Results opens, **Then** results are ordered and grouped by package assignment and session.
3. **Given** a result correction, **When** the tab refreshes, **Then** effective values update while original/correction provenance remains visible.
4. **Given** existing class analysis, **When** this feature is enabled, **Then** existing Analysis calculations and routes remain unchanged.

### Edge Cases

- Workbook is missing one required sheet, contains duplicate session/item keys, or has fewer/more than 80 items.
- Workbook has blank Vietnamese/English complete sentences or a CCI/CVR identifier with no matching definition.
- Session 1 Item 10 retains `cci-002` while Session 1 measurement maps to `cci-001`.
- Obsolete test data has dependencies outside the allowlisted test-only relationship graph.
- Replacement preview counts differ from counts immediately before execution.
- A package is published while audio is incomplete; content publication succeeds but runtime readiness remains blocked.
- Approved narration is missing, stale, rejected, or unavailable during setup.
- A Teacher attempts to select two learners or a learner from another organization.
- A browser closes during a run and the Teacher resumes it.
- A correction occurs after package/resource metadata receives a later version.

## Requirements *(mandatory)*

### Functional Requirements

> This feature preserves immutable history for newly created standalone results. Its explicitly approved reset is limited to obsolete test/resource imports and dependent test-only rows identified by the replacement preview. Accounts, learner profiles, classes, enrollments, and non-test history are excluded.

- **FR-001**: The system MUST treat the attached workbook, identified by its recorded file hash, as the canonical source for this replacement.
- **FR-002**: The system MUST validate exactly one package, eight ordered sessions, and 80 ordered items before replacement can proceed.
- **FR-003**: The system MUST map session CVR from workbook `CVR-id` values and CCI value from workbook `Ampe (A)` values.
- **FR-004**: The system MUST retain each CCI identifier, CCI Name, description, category when present, Ampe value, and source provenance.
- **FR-005**: The system MUST derive CPD reproducibly from the recorded session CVR and CCI Ampe snapshot.
- **FR-006**: The system MUST show all validation issues and exact deletion impact counts before enabling destructive confirmation.
- **FR-007**: The destructive reset MUST abort if actual row counts or dependency scope differ from the reviewed preview.
- **FR-008**: The reset MUST delete only obsolete test/resource rows and explicitly reviewed dependent test-only rows; it MUST NOT delete accounts, learners, classes, enrollments, or non-test sessions/results.
- **FR-009**: The system MUST preserve the Session 1 Item 10 CCI mismatch as source metadata and display it as a review warning.
- **FR-010**: The canonical replacement MUST be created as a draft and MUST require review before publication.
- **FR-011**: Published package versions, measurement snapshots, approved run configuration, and standalone result history MUST be immutable; changes require new versions, superseding snapshots, or corrections.
- **FR-012**: Resource management MUST provide package/session, CCI, item/CVR, import issue, and audio-readiness views.
- **FR-013**: Session introduction source text MUST include Session number, CVR, CCI Ampe, and CCI Name.
- **FR-014**: Item narration MUST use the complete sentence in the selected Vietnamese or English language.
- **FR-015**: Generated narration MUST require explicit approval and matching source provenance before runtime use.
- **FR-016**: A standalone run MUST select exactly one active Learner and MUST NOT require or create a Class or Enrollment.
- **FR-017**: A standalone run MUST snapshot package version, session measurement, prompt language, voice, approved narration, and ordered items before starting.
- **FR-018**: Runtime start MUST be blocked unless the selected language/voice has one approved current introduction and approved current narration for all ten items.
- **FR-019**: Result/probe/correction transitions MUST be enforced consistently and only finalized/corrected results may feed Test Results.
- **FR-020**: Standalone data MUST use routes, runtime state, and persistence distinct from live class sessions.
- **FR-021**: Learner profile MUST include a separate Test Results tab and existing Analysis MUST remain unchanged.
- **FR-022**: Test Results MUST show package/version, session, CVR, CCI Name/Ampe, CPD, language, completion, finalized totals, correction state, and provenance.
- **FR-023**: Admin, Teacher, and Learner access MUST be organization/ownership scoped, with cross-organization access denied.
- **FR-024**: A failed replacement or release MUST have a verified restore/rollback path before production execution.
- **FR-025**: Production replacement, narration infrastructure activation, and deployment MUST each require explicit approval after preview/canary checks.

### Key Entities

- **Canonical Test Package**: The reviewed test definition imported from the source workbook.
- **Package Version**: An immutable published snapshot or editable draft of a package.
- **Test Session**: One ordered section of the package containing ten items and one session measurement.
- **Test Item**: One ordered bilingual term/complete-sentence prompt with source identifiers.
- **CCI Definition**: A named CCI unit with Ampe, description, category, and source identity.
- **Session Measurement Snapshot**: Immutable CVR + CCI Name/Ampe provenance used to derive CPD.
- **Narration Variant**: Generated or uploaded language/voice audio with source hash and approval state.
- **Standalone Test Assignment**: One Learner assigned to one package version across its sessions.
- **Standalone Test Run**: One Learner’s attempt at one package session with snapshotted runtime settings.
- **Standalone Test Result**: Immutable event/current snapshot for one run item, including correction provenance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Replacement preview consistently reports one package, eight sessions, 80 items, and zero missing complete sentences for the canonical workbook.
- **SC-002**: All eight sessions display the expected CVR sequence and CCI Ampe sequence with the correct workbook CCI names.
- **SC-003**: 100% of destructive replacements abort when reviewed counts or allowed dependency scope change before execution.
- **SC-004**: An Admin can locate any session, CCI definition, or test item and see its readiness/provenance in under 30 seconds.
- **SC-005**: A Teacher can set up a one-learner test session in under two minutes without creating or selecting a Class.
- **SC-006**: 100% of standalone runs are blocked when any required selected-language audio is missing, stale, or unapproved.
- **SC-007**: A completed ten-item run appears in the learner Test Results tab with reproducible CPD/provenance within five seconds of refresh.
- **SC-008**: Existing live class-session workflows and Analysis produce unchanged results in regression checks.
- **SC-009**: Unauthorized cross-organization and cross-learner reads/writes are denied in all tested paths.
- **SC-010**: The canary validates one learner and one session, plus database, audio, and application rollback paths, before production release.

## Assumptions

- The newly attached workbook is byte-identical to the reviewed source and remains the canonical replacement input.
- “Delete old data” means obsolete test/resource imports and their explicitly reviewed test-only dependencies, not general LMS data.
- The existing completed legacy test session and ten linked attempts are included in the destructive preview and require final confirmation immediately before remote execution.
- The canonical workbook’s session mapping determines CPD CCI; item-level differing CCI IDs remain provenance warnings.
- Teachers may test any active Learner in their organization without a Class.
- The existing authenticated staff model is reused; no new learner account model is introduced.
- Generated audio is private and must be reviewed before use.
- LLM content generation remains review-only/future-facing; this release does not auto-publish generated test content.
