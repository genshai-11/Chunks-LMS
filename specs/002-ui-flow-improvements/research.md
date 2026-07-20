# Phase 0 Research: UI & Flow Improvements

No NEEDS CLARIFICATION items remain — all unknowns resolved against repo evidence.

## D1: Branch strategy

- **Decision**: Work on `feat/ui-flow-improvements`, created as a child of `feat/standalone-learner-tests` at commit `0288ee1`.
- **Rationale**: Owner explicitly requested a child branch of the current branch so UI/flow fixes layer on top of the standalone-learner-tests work without polluting it.
- **Alternatives considered**: Branching from `main` — rejected, would lose the standalone-tests baseline the fixes depend on. Reusing the current branch — rejected, mixes concerns and complicates review.

## D2: CI/CD trigger map (deployment impact)

Evidence: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`.

| Action | CI | CD preview | CD production |
|---|---|---|---|
| Push to `feat/ui-flow-improvements` | ❌ not triggered | ❌ | ❌ |
| Open/sync PR (any base) | ✅ runs | ✅ Vercel preview (if secrets set; skips gracefully otherwise) | ❌ |
| Push to `main`/`master` | ✅ runs | ❌ | ✅ Vercel production — **FORBIDDEN without explicit approval** |
| `supabase db push --linked` | — | — | production-impacting — **FORBIDDEN without explicit approval** |

- **Decision**: Commit locally on the feature branch. Pushing the feature branch is deployment-neutral but still reported before doing. PRs (CI + preview) only when the owner asks. Never push to `main`/`master`.
- **Rationale**: Satisfies AGENTS.md release controls and Constitution Principle V; owner's rule "commit CI only, never run CD on my own".
- **Alternatives considered**: Push every commit to the feature branch for backup — acceptable on request, but not required since it triggers nothing.

## D3: Scope confinement — presentation layer only

- **Decision**: Fixes touch only `web/src/pages/`, `web/src/components/`, `web/src/hooks/`, `web/src/state/`, `web/src/index.css`. No changes to `web/src/modules/` domain rules, `supabase/migrations/`, RLS, or RPCs.
- **Rationale**: Constitution Principles I–III (immutable history, module boundaries, database-owned authorization). UI must not independently reproduce scoring/probe/authorization logic (AGENTS.md engineering constraints).
- **Alternatives considered**: Allowing small "convenience" domain tweaks inside UI fixes — rejected; any bug whose fix needs domain/data changes is escalated to a new spec.

## D4: Intake-driven task management

- **Decision**: `tasks.md` starts as an empty intake log with a fixed entry format (ID, route, role area, repro, expected/actual, severity, status, resolution commit). Each owner bug report becomes one task group; fixes land one concern per commit.
- **Rationale**: Owner will send bugs incrementally ("rồi t gửi lỗi mày fix"); the plan must be executable per-report without re-planning.
- **Alternatives considered**: Pre-writing speculative fix tasks — rejected; violates "fix what's reported" and risks scope creep.

## D5: Verification (CI parity) commands

Evidence: `web/package.json`, `.github/workflows/ci.yml`.

- **Decision**: Before every push/PR, run in `web/`: `npm run lint` (oxlint), `npm run typecheck` (tsc -b), `npm run test` (vitest run), `npm run build` (with `VITE_AUTH_BYPASS=true` parity). Run `npx --yes @fission-ai/openspec@latest validate --all` when OpenSpec artifacts change (not expected in this feature).
- **Rationale**: Mirrors the CI quality job exactly; Constitution Principle IV requires reporting any check that cannot run.
- **Alternatives considered**: Playwright e2e (`npm run test:e2e`) — optional per-fix when a flow bug warrants it; not part of CI.

## D6: Agent context update script

- **Decision**: Skipped — `.specify/scripts/powershell/` contains no `update-agent-context` script (only `check-prerequisites`, `common`, `create-new-feature`, `setup-plan`, `setup-tasks`).
- **Rationale**: Nothing to run; recorded for completeness per the plan workflow.
