# Chunks-LMS Agent Instructions

## Product boundary

Chunks-LMS measures learner Focus and Awareness through teacher-observed assessments. It is not a content-authoring or resource-library platform.

Before changing the project, read `CONTEXT.md`, relevant files under `docs/adr/`, and `docs/architecture/chunks-lms-architecture-review.md`.

## Agent skills

Installed from [mattpocock/skills](https://github.com/mattpocock/skills) into:

- `.agents/skills/` — canonical project skills
- `.grok/skills/` — Grok Build copy (same content)

**Setup already done** via `docs/agents/` (do not re-run `/setup-matt-pocock-skills` unless config must change).

### Issue tracker

Issues and PRDs live in GitHub Issues for `genshai-11/Chunks-LMS`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical triage vocabulary documented in `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Primary engineering skills

| Skill | When |
|---|---|
| `/grill-with-docs` | Align on a change; update glossary/ADRs while grilling |
| `/triage` | Move GitHub issues through needs-triage → ready-for-agent |
| `/to-spec` | Publish a discussed plan as a tracker issue |
| `/to-tickets` | Break a plan into blocked tracer-bullet tickets |
| `/implement` | Build from tickets/specs with `/tdd` + `/code-review` |
| `/tdd` | Red-green-refactor for domain rules |
| `/domain-modeling` | Sharpen CONTEXT.md / ADR language |
| `/ask-matt` | Router when unsure which skill fits |

## OpenSpec workflow

OpenSpec uses the core profile and is initialized under `openspec/`. Inspect state with JSON commands before changing artifacts. Use `/opsx:explore` for unresolved architecture, `/opsx:propose` for a concrete change, and `/opsx:apply` only after its artifacts and tasks are ready.

Current change: `establish-lms-foundation` — **apply complete** (all tasks checked).

- App: `web/` (Vite + React + TS) — Admin / Teacher / Learner surfaces
- Domain + tests: roster, sessions, capture, result lifecycle, metrics, report windows, realtime auth
- DB: `supabase/migrations/` + `seed.sql`
- CI/CD: `.github/workflows/ci.yml`, `cd.yml`, `docs/ops/ci-cd.md`
- Demo: Home → **Load seeded e2e demo** then open Teacher/Learner progress panels

Next product work: wire live Clerk + Supabase, archive OpenSpec change when ready, ship first hosted preview.

## Engineering constraints

- Preserve immutable assessment, probe, finalization, and correction history.
- Do not implement scoring rules independently in UI callers.
- Only finalized results feed progress metrics.
- Treat question sequence numbers as presentation, not stable identity.
- Keep learner-first and question-first as UI modes over the same domain model.
- Enforce authorization in Supabase RLS, not only in application UI.
- Treat V1 metrics as operational indicators, not validated psychometric instruments.
- Keep resource content and CCI/CVR integrations outside the V1 core domain.
