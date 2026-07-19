# ADR 0006: Standalone one-to-one learner tests

**Status:** Accepted for implementation  
**Date:** 2026-07-19

## Context

The existing Live Test extension stores test input on Class-bound Learning Sessions. The requested workflow selects one Learner directly, has no Class/Enrollment, uses a canonical eight-session workbook package, requires approved bilingual narration, and reports CPD separately.

The hosted compatibility catalog also mapped CVR values into CCI. The canonical workbook instead defines session CVR in `CVR-id` and CCI in `CCI.Ampe (A)` with a CCI Name.

## Decision

Create a separate Standalone Test Assignment/Run aggregate:

- one active Learner and one published package version per assignment;
- one Test Section per run;
- frozen CVR, CCI ID/Name/Ampe, language, voice, approved narration, and ordered Test Items;
- separate attempts, append-only events, and current snapshots using the accepted color/probe/correction semantics;
- separate Teacher routes/state and learner-profile Test Results;
- no Class, Enrollment, Learning Session, Session Question, or live capture dependency.

Canonical CPD is reproducible as session `CVR-id × CCI.Ampe (A)`. Item-level source CCI mismatches remain import provenance warnings.

## Consequences

- Existing live observation and Analysis remain unchanged.
- The standalone module duplicates the event/snapshot storage shape but shares measurement semantics.
- Published package/history rows remain immutable; the explicitly requested obsolete test reset is a separately previewed, guarded, confirmed transaction.
- Runtime cannot start until current approved intro and all ten item narrations exist for the selected language/voice.
