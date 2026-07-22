# Quickstart Validation: UI & Flow Improvements

Runnable validation for each fix batch. Reference: route map in `contracts/ui-routes.md`; no data changes (`data-model.md`).

## Prerequisites

- Node 22, npm dependencies installed: `cd web && npm ci`
- Branch: `feat/ui-flow-improvements`
- Optional env for auth-free local run (CI parity): `VITE_AUTH_BYPASS=true`

## Per-fix validation loop

```powershell
cd web
npm run lint        # oxlint
npm run typecheck   # tsc -b --pretty false
npm run test        # vitest run
$env:VITE_AUTH_BYPASS='true'; npm run build   # CI build parity
```

Expected: all four green before commit. If a check cannot run, report exactly which one and why (Constitution IV).

## Smoke scenarios (after each fix batch)

1. **Home → role entry**: `npm run dev`; `/` renders the three role entries; unknown route (e.g. `/nope`) redirects to `/`.
2. **Admin**: sign in (or bypass) → `/admin` → people (accounts active/inactive, invites) → metrics catalog → analysis. Expect deliberate empty states where no data.
3. **Teacher**: `/teacher` → learner tree → classes → session start (select 1..N learners) → `/teacher/observe` → analysis. Expect probe counters labeled n count / n depth / n depth max / n depth avg.
4. **Learner**: `/access?email=<registered>` → (multi-enrollment: class picker) → `/learner` overview → `/learner/analysis`. Expect only own rows; legacy redirects (`/learner/attendance`, `/learner/results`, `/learner/progress`) resolve.

## Deployment-impact statement (required before any push)

- Push to `feat/ui-flow-improvements`: triggers **nothing** (CI is PR + main/master only; CD preview is PR only; production is main/master only).
- Open/sync PR: CI + Vercel **preview** — do only when the owner asks.
- Push to `main`/`master`: CI + **production deploy** — never without explicit yes/no approval in the current turn.
