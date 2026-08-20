## Context

The current product model finalizes on a 4-color scale: Red, Yellow, Green, and Purple. Green opens a probe flow, but Done currently resolves back to Green and Continue is a probe event rather than a reportable spectrum step. The new product decision is an official 7-color spectrum where primary capture starts with Red/Orange/Green/Purple and the Green probe produces Yellow/Blue/Indigo measurement steps.

## Decisions

### Spectrum vocabulary

Use this canonical spectrum for capture, storage, heatmaps, metrics, and CPD factors:

| Color | Shortcut | Source | Warm/Cool | CPD factor |
|---|---:|---|---|---:|
| Red | 0 | Primary dock | Warm | 0.00 |
| Orange | 1 | Primary dock | Warm | 0.17 |
| Yellow | F or 1 | Probe Fail | Warm | 0.33 |
| Green | 2 | Primary dock / probe entry | Cool | 0.50 |
| Blue | C or 2 | Probe Continue | Cool | 0.67 |
| Indigo | D, 3, or Enter | Probe Done | Cool | 0.83 |
| Purple | 3 | Primary dock | Cool | 1.00 |

### Capture lifecycle

- Primary dock always displays four large buttons: `0 · Red`, `1 · Orange`, `2 · Green`, `3 · Purple`.
- Red, Orange, and Purple can finalize directly.
- Green is a probe-entry color and must open the Probe Flow dock immediately.
- Probe Fail finalizes effective color Yellow.
- Probe Continue records a Blue probe step and keeps the probe open until Done or explicit Fail.
- Probe Done finalizes effective color Indigo.
- The system must retain immutable probe history and current effective-color snapshots.

### Reporting denominator

Use actual measured steps for spectrum metrics:

`N_total = planned_primary_count + sum(probe_steps)`

For the standard test, `planned_primary_count = 49`, so three probe steps means `N_total = 52`.

### RFC and RAC / %c

- Warm colors: Red, Orange, Yellow.
- Cool colors: Green, Blue, Indigo, Purple.
- `RFC = warm_steps / N_total * 100%`.
- `%c` / `RAC = cool_steps / N_total * 100%`.
- Open/unresolved probe state must not be treated as finalized reporting output until the lifecycle rules define its effective current state.

### Performance

Capture interactions should use optimistic local state for the active cell/probe flow and avoid refetching all seven sessions after each click. Server writes remain authoritative; failed writes roll back or show recoverable error state.

## Risks / Trade-offs

- Existing persisted data uses older color names and values; migration/backfill requirements must be identified before remote apply.
- Existing tests and metrics may encode Yellow as direct `1`; Orange must replace direct primary `1` while Yellow becomes probe Fail.
- Blue is both a probe step and a cool-color reporting contributor; storage must distinguish probe history from final effective result.
- Any database enum/check constraint changes are production-impacting and require explicit remote approval.

## Open Questions

- Should `Green` ever be stored as a final effective color, or only as probe-entry/provisional state?
- Should `Blue (Continue)` contribute to `N_total` immediately while the probe remains open, or only after the attempt is eventually finalized?
- Should legacy Yellow direct results be displayed as Orange, Yellow, or require a data migration map?
