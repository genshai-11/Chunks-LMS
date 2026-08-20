## Purpose

Standardize capture on the official 7-color spectrum: a 4-button primary dock, a 3-button Green probe dock, effective-color heatmaps, probe-aware totals, warm/cool RFC/RAC, normalized CPD values, and optimistic capture performance.

## What Changes

- Replace the primary capture dock labels with `0 · Red`, `1 · Orange`, `2 · Green`, and `3 · Purple`.
- When Teacher selects `2 · Green`, immediately open the Probe Flow dock instead of finalizing Green directly.
- Standardize probe actions as `Yellow (Fail)`, `Blue (Continue)`, and `Indigo (Done)` with keyboard shortcuts `F/1`, `C/2`, and `D/3/Enter`.
- Store and display the final effective spectrum color after probe resolution: Fail becomes Yellow, Done becomes Indigo, direct colors remain Red/Orange/Purple.
- Show probe depth badges (`+n`) on heatmap cells with probe history.
- Count actual measurement steps as `N_total = 49 + sum(probes)` for spectrum-based reporting.
- Calculate RFC from warm colors and RAC/%c from cool colors over `N_total`.
- Normalize CPD color factors from `0.0` to `1.0` across Red, Orange, Yellow, Green, Blue, Indigo, and Purple.
- Optimize capture so each click updates the current cell/probe state immediately without refetching all seven sessions.

## Non-Goals

- Do not change learner Auth or organization membership scope.
- Do not add content authoring or resource-library behavior.
- Do not deploy or apply remote Supabase changes without explicit approval.
- Do not use the auth cutover task file for this work.

## Impact

- Domain model changes from a 4-color result scale to a 7-color spectrum.
- Assessment capture UI, keyboard handling, result lifecycle, heatmap rendering, metrics, CPD matrix, tests, and documentation require coordinated updates.
- Existing reports and fixtures that assume Red/Yellow/Green/Purple finalized results need migration or compatibility review.
