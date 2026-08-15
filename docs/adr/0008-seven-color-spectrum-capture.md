# ADR 0008: Seven-color spectrum capture

**Status:** Accepted  
**Date:** 2026-08-15

## Context

The previous lifecycle stored a four-color result scale while parts of the capture UX displayed an Orange label over the old Yellow value. Green probe Done resolved back to Green, Continue remained only a probe event, and reporting denominators counted finalized primary attempts rather than actual measured probe steps.

## Decision

Teacher capture uses the official 7-color spectrum: Red, Orange, Yellow, Green, Blue, Indigo, and Purple.

- Primary dock: `0 · Red`, `1 · Orange`, `2 · Green`, `3 · Purple`.
- Green always opens Probe Flow.
- Probe Fail resolves effective color Yellow.
- Probe Continue records Blue probe depth and keeps the probe open.
- Probe Done resolves effective color Indigo.
- Heatmaps display effective spectrum color plus probe depth badge.
- Spectrum RFC/RAC use `N_total = planned primary questions + sum(probe steps)`.
- CPD factors use normalized values from `0.00` to `1.00` across the 7 colors.

## Consequences

- Persisted database enum values and score columns require migration before hosted runtime can accept Orange/Blue/Indigo.
- UI callers must not independently infer probe final colors; lifecycle helpers/RPCs own the mapping.
- Existing reports that display color counts must include all 7 colors or explicitly state they are a legacy four-color view.
- Remote Supabase migration is production-impacting and requires explicit approval before apply.
