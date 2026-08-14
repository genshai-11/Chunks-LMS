# Tasks: 7-Color Probe Flow, Dynamic CPD Matrix, Sample Expansion, and API Caching Layer

## 1. Domain Types & State Machine (TDD)
- [x] 1.1 Update `ResultColor` and add 7-color definitions, warm/cool groups, and `recordedColors: ResultColor[]` in `web/src/modules/result-lifecycle/types.ts`.
- [x] 1.2 Update `applyLifecycleCommand` state machine in `state-machine.ts` to record Green -> Continue (Blue) -> Done (Indigo) / Fail (Yellow) and preserve full sequence.
- [x] 1.3 Add unit tests in `state-machine.test.ts` for 7-color provisional and multi-step probe transitions.

## 2. Expanded Sample Metrics & Dynamic CPD Engine (TDD)
- [x] 2.1 Update `web/src/modules/metrics/calculate.ts` to support 7 colors, dynamic color weights $x \in [0, 1]$, expanded sample size $N_{\text{total}}$, RFC (Warm colors) and RAC ($1 - \text{RFC}$).
- [x] 2.2 Implement question-level and learner-level CPD calculation averaging across `recordedColors`.
- [x] 2.3 Add comprehensive unit tests in `calculate.test.ts` verifying expanded sample, RFC/RAC calculations, and dynamic CPD derivation.

## 3. In-Memory SWR API Caching Layer
- [x] 3.1 Implement lightweight in-memory cache utility with TTL, deduplication, and stale-while-revalidate in `web/src/lib/api-cache.ts`.
- [x] 3.2 Add unit tests in `web/src/lib/api-cache.test.ts`.
- [x] 3.3 Integrate caching layer into Supabase sync and teacher workspace fetchers to eliminate full screen reload and redundant egress on navigation.

## 4. UI: Observe Dock, Admin Color Settings & Analysis
- [x] 4.1 Update Teacher Observe Dock in `TeacherObservePage.tsx` with primary 4-color buttons (Red, Orange, Green, Purple) and 3-color probe dock (Yellow Fail, Blue Continue, Indigo Done).
- [x] 4.2 Update CSS styles for 7 distinct rainbow colors with high contrast and accessible labels.
- [x] 4.3 Add Admin Color Weight Matrix setup in Admin settings with Linear presets and custom weight inputs.
- [x] 4.4 Update Progress Analysis and Report components to display 7 colors and dynamic CPD.

## 5. Verification & CI/CD Gate
- [x] 5.1 Run `npm run openspec:validate`.
- [x] 5.2 Run `npm run lint`.
- [x] 5.3 Run `npm run typecheck`.
- [x] 5.4 Run `npm test`.
- [x] 5.5 Run `npm run build`.
