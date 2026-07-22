# Implementation Plan: UI & Flow Improvements

**Branch**: `feat/ui-flow-improvements` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-ui-flow-improvements/spec.md`

## Summary

Intake-driven fix cycle for UI (presentation) and Flow (navigation/interaction) bugs across Admin, Teacher, and Learner areas of the React SPA. Fixes are confined to the presentation layer, verified with CI-parity checks (lint/typecheck/test/build), and committed only to the feature branch — never triggering CD/production without explicit approval. Approach: per-bug intake log in `tasks.md` → reproduce → fix → CI-parity verify → commit one concern at a time (research.md D3/D4).

## Technical Context

**Language/Version**: TypeScript ~6.0.2, React 19.2, Vite 8.1
**Primary Dependencies**: react-router-dom 7.18, Tailwind CSS 4.3 (+ @tailwindcss/vite), @supabase/supabase-js 2.110, lucide-react, motion, recharts, zod 4
**Storage**: Supabase/Postgres — unchanged; this feature performs no migrations and no data-shape changes
**Testing**: Vitest 4 (`npm run test`) + @testing-library/react + jsdom; oxlint (`npm run lint`); `tsc -b` (`npm run typecheck`); CI-parity build with `VITE_AUTH_BYPASS=true`
**Target Platform**: Browser SPA (Vite dev server / static build)
**Project Type**: Web frontend (single `web/` app, routes in `web/src/App.tsx`)
**Performance Goals**: No new jank in observe/session screens; fixes must not add network waterfalls to role landing pages
**Constraints**: Presentation-layer only (FR-002); CONTEXT.md vocabulary in UI copy (FR-003); no auth/gating behavior changes (FR-004/FR-005); commit CI only, zero CD without explicit approval (FR-007/FR-010)
**Scale/Scope**: ~30 routes across 3 role areas (see `contracts/ui-routes.md`); bug count = however many the owner reports

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Measurement and correction history remains immutable — FR-009 forbids any data-mutation behavior; no destructive operations in scope. (Principle I)
- [x] Standalone tests remain separate from Class-based Learning Sessions — no module-boundary changes; route contract documents the existing separation. (Principle II)
- [x] RLS, privileged RPC grants, actor checks, hardened `search_path` — untouched; FR-005 forbids authorization behavior changes in UI fixes. (Principle III)
- [x] Import/migration discipline — no migrations in scope; escalation rule in `data-model.md` routes any data need to a new spec. (Principle IV)
- [x] Tests cover the change — FR-006 requires CI-parity lint/typecheck/test/build per fix; domain rules untouched so no new domain tests required. (Principle IV)
- [x] Preview/canary, rollback/restore, commit/tag, post-deploy gates — FR-007/FR-010 + quickstart deployment-impact statement; production stays forbidden without explicit approval. (Principle V)

**Result: PASS — no violations, no Complexity Tracking entries required.**

## Project Structure

### Documentation (this feature)

```text
specs/002-ui-flow-improvements/
├── plan.md              # This file
├── research.md          # Phase 0 output (D1–D6)
├── data-model.md        # Phase 1 output (N/A + escalation rule)
├── quickstart.md        # Phase 1 output (validation loop + smoke scenarios)
├── contracts/
│   └── ui-routes.md     # Route → gate contract (FR-008)
└── tasks.md             # Intake log + per-bug task groups (grows per report)
```

### Source Code (repository root)

```text
web/
├── src/
│   ├── App.tsx              # Route declarations (contract source)
│   ├── index.css            # Tailwind/global styles
│   ├── auth/                # AuthProvider, StaffGate — NOT modified by fixes
│   ├── components/          # Shared UI (AppShell, …) — fixable
│   ├── hooks/               # Presentation hooks — fixable
│   ├── state/               # AppState, learner scoping state — fixable w/ FR-004 care
│   ├── pages/
│   │   ├── HomePage.tsx, LearnerAccessPage.tsx, ChunkerPage.tsx
│   │   ├── admin/           # Admin console screens (P3 fixes)
│   │   ├── teacher/         # Teacher flow screens (P1 fixes)
│   │   └── learner/         # Learner portal screens (P2 fixes)
│   └── modules/             # DOMAIN RULES — OFF-LIMITS to this feature (FR-002)
└── package.json             # lint/typecheck/test/build scripts (CI parity)
```

**Structure Decision**: Existing single-app layout under `web/` is reused as-is. Fixes land in `pages/<role>/` first, then shared `components/`/`hooks/`/`state/` only when the defect lives there. `auth/` and `modules/` are out of bounds.

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 artifacts (research.md, data-model.md, contracts/ui-routes.md, quickstart.md): all six gates still PASS. The route contract adds documentation only; the data-model artifact is an explicit no-change verdict with an escalation rule. No complexity justifications needed.

## Next Gate

Phase 2 (`/speckit-tasks`) expands `tasks.md` per incoming bug report. Implementation begins only when the owner sends the first concrete bug list.
