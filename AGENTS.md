# Chunks-LMS Agent Instructions

## Product boundary

Chunks-LMS measures learner Focus and Awareness through teacher-observed assessments. It is not a content-authoring or resource-library platform.

Before changing the project, read `CONTEXT.md`, relevant files under `docs/adr/`, and `docs/architecture/chunks-lms-architecture-review.md`.

## Agent skills

### CodeGraph-first code reading

**Before broad code search or reading implementation files, invoke `[skill:codegraph-advisor]`.**

1. Run the CodeGraph preflight/status check and sync the graph when stale.
2. Use `codegraph explore` for architecture, behavior, dependency, caller/callee, and impact questions.
3. Use `codegraph query` for exact symbol lookup.
4. Read only the relevant source files afterward to verify graph conclusions.
5. If CodeGraph cannot index a language/file, report that limitation before falling back to normal search.

The local `.codegraph/` index is machine-generated and must not be committed. Project MCP integration is declared in `.mcp.json`.

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
| `[skill:codegraph-advisor]` | Required before broad code reading/search; trace architecture and blast radius with CodeGraph first |
| `/cowork` | Standard 4-step pair programming: clarify & confirm plan -> prompt subagent to implement & test -> verify local CI -> deploy Vercel Preview |
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

**Foundation change archived** (Phase E): `openspec/changes/archive/2026-07-11-establish-lms-foundation/`.  
Main specs live under `openspec/specs/` (7 capabilities). No active change by default.

- App: `web/` (Vite + React + TS) — Admin / Teacher / Learner
- Domain + tests: roster, sessions, capture, lifecycle, metrics, reporting, ops, sync
- DB: `supabase/migrations/` + `seed.sql` (local) + `supabase/seeds/production-starter.sql` (idempotent)
- CI/CD: `.github/workflows/ci.yml`, `cd.yml`
- **Ship:** [`docs/ops/production-runbook.md`](docs/ops/production-runbook.md)

## System Architecture & Module Map

| Module / Path | Domain Purpose | Data Flows & Key Artifacts |
|---|---|---|
| [`modules/catalog`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/modules/catalog) | Test packages, versions, sections, test items, CVR physics calculation ($TC \times LC \times TL$), CCI profiles/curves, AI live test generator, and Mini-Test Variant Generator (`createMiniTestVariantFromPackage`). | Firestore vocab / input prompts → `test_packages`, `test_package_versions`, `test_sections`, `test_items`, `cci_profiles` → feeds Scheduling and Assessment. |
| [`modules/assessment`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/modules/assessment) | Live observation runtime, scoring logic (Green/Orange/Red), probe workflows (`enteredProbeFlow`, `probeCount`), and dual UI modes (learner-first / question-first). | Teacher scoring inputs → live state machine → `assessments`, `assessment_probes` (immutable observation stream). |
| [`modules/result-lifecycle`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/modules/result-lifecycle) | Lifecycle state transitions: submission, finalization, corrections, and revocations. Guarantees result immutability and audit trails. | Assessment events → Finalize / Correct → `finalized_results`, `result_corrections` → only finalized data flows downstream. |
| [`modules/metrics`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/modules/metrics) | Focus and Awareness metrics calculation, probe indicators (`n count`, `n depth`, `n depth max`, `n depth avg`), CVR/CCI analytics, and cohort rollups. | `finalized_results` → calculation engine (`calculateMetrics`, `n_*` aggregations) → Teacher & Admin analysis dashboards. |
| [`modules/roster`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/modules/roster) | Learner trees, cohorts, programs, classes, student enrollments, and seating charts. | Staff management CRUD → `learners`, `classes`, `programs`, `learner_enrollments` → drives learner selection in sessions. |
| [`modules/scheduling`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/modules/scheduling) | Session planning, session lifecycle states (`draft`, `active`, `completed`), session kinds (`regular`, `pretest`, `posttest`), and seat assignments. | Roster learners + Catalog test packages → `sessions`, `session_learners` → initializes Assessment runtime. |
| [`modules/sync`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/modules/sync) | Offline queueing, optimistic local storage, network resilience, conflict resolution, and background sync to Supabase. | Local mutation queue (IndexedDB/localStorage) → online detector → idempotent batch replay to Supabase tables. |
| [`auth`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/auth) | Staff authentication (Supabase Auth), persistent session management, role verification (`admin`, `teacher` via `staff_roles`), and route guards. | `auth.users` → `staff_roles` → `StaffSessionContext` / `StaffGate` → UI workspace gating (Admin vs Teacher). |
| [`lib/test-packages`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/lib/test-packages.ts) | Data access layer & API client for test packages, sections, items, CCI categories, narration generation, and zero-waste mini-test variants. | UI / Studio → Supabase RPC & client queries, Edge functions (`generate-narration`, `get-playback-url`) → `narration_variants`. |
| [`lib/standalone-tests`](file:///C:/Users/gensh/Desktop/CHUNKS/PROJECT/Chunks-LMS/web/src/lib/standalone-tests.ts) | Standalone test run execution, local test runners, audio playback chaining, and offline/isolated test evaluation. | Test package snapshot → standalone runner → 2-step prefix chaining audio playback (`/audio/number_{order}.wav` + variant) → evaluation. |

## V1 identity (product decision)

**No organization membership product for now.**

| Role | Access | Scope |
|------|--------|--------|
| **Admin** | Supabase Auth | **Accounts** (teacher/learner active\|inactive) + **Metrics** catalog (enable/label/min sample). Not courses/classes. |
| **Teacher** | Supabase Auth | **Learner tree first** → programs/classes/seating → start session (1..N learners, pretest/posttest) → observe → analysis. |
| **Learner** | No app login | Staff-managed profile only. Results are reviewed through Teacher/Admin analysis. |

- Staff maps native `auth.users.id` → stable domain `users.auth_user_id`; active database `staff_roles` authorize Admin/Teacher.
- Learner portal/share-link access is removed from the current V1 runtime.
- Membership, multi-org, and learner Auth accounts are **Phase F / later**.

### Flow (current product)

```text
Home → Admin (Supabase Auth)  accounts (active/inactive) · metrics catalog · analysis
     → Teacher (Supabase Auth) learners tree → classes/programs → start session (select HV)
                              → observe (per-learner columns / learner-first) → analysis
```

### Probe counters (product language)

| Label | Meaning | Domain field |
|-------|---------|--------------|
| **n count** | Times teacher selected Green (2) / entered probe | `enteredProbeFlow` count |
| **n depth** | Depth on one question (Pass/Continue + resolve) | `probeCount` |
| **n depth max** | Peak observed depth in window | `max(probeCount)` on probed |
| **n depth avg** | Mean depth on probed questions | mean `probeCount` / metric `n_depth_avg` |

Never label finalized sample size as “n” — use `sample=` / finalized.  
Session **ceiling** (`maxProbeCount`) is not “n depth max”.

### Session labels

`sessionKind`: `regular` | `pretest` | `posttest` — pretest/posttest for RFC baseline vs later change.

### LMS maturity (post flow pivot)

| Layer | ~% | Reality check |
|-------|----|----------------|
| Domain + ADRs + unit tests | 90–95 | Measurement core + n_* metrics |
| Role UI (CRUD / observe / analysis) | ~90 | Admin accounts/metrics; Teacher learner-first |
| Staff Supabase Auth (Admin/Teacher gates) | ~85 | Native persistent session + database `staff_roles`; `VITE_AUTH_BYPASS` for CI |
| Learner portal/share-link | Removed | No public learner access in current V1 runtime |
| Multi-class / teacher-owned programs | ~85 | Teacher creates program/class/seat |
| Hosted multi-user production | ~85 | Runbook + OpenSpec archive |
| **Overall V1 production readiness** | **~88** | First class shippable; live sign-off via runbook |

**Full plan (phases A–F):** [`docs/plans/lms-completion-by-role.md`](docs/plans/lms-completion-by-role.md) — still historical for A–E; product flow above is authoritative for Admin vs Teacher ownership.

**V1 “100%” definition:** Admin provisions accounts + metrics; teachers own learners/sessions/capture/analysis; multi-class teacher works; hosted course without data loss.

## Release controls and deployment gates

- **Never trigger CD/production deploy without explicit user confirmation in the current turn.** This includes `git push` to `main` / `master`, Vercel production deploys, Firebase/Hosting deploys, Functions deploys, or any command documented to trigger production CD.
- **CI green is required before asking for production deploy approval.** If full CI cannot run, report exactly which checks passed/failed and do not deploy.
- **Always identify deployment impact before pushing.** Read `.github/workflows/` or the relevant deploy docs first, then state whether the next command triggers preview, production, DB migration only, or no deploy.
- **Use preview/canary first when available.** Push feature branches or PRs for preview validation before production unless Lucy explicitly says to skip preview.
- **Commit and tag before production-impacting actions.** Keep rollback instructions and verify the restore path for Hosting/Functions/DB changes.
- **Supabase migrations are production-impacting.** Run dry-run/list checks first, then ask before applying to a linked remote project unless Lucy has already explicitly approved that exact migration in the current turn.
- **Do not treat “continue” as deploy approval.** Ask a yes/no confirmation before any production-triggering action.

## Engineering constraints

- Preserve immutable assessment, probe, finalization, and correction history.
- Do not implement scoring rules independently in UI callers.
- Only finalized results feed progress metrics.
- Treat question sequence numbers as presentation, not stable identity.
- Keep learner-first and question-first as UI modes over the same domain model.
- Staff workspaces: gate with native Supabase Auth plus database `staff_roles`. Do not reintroduce learner portal/share-link access unless product scope changes.
- Prefer Supabase RLS for staff-backed data paths when configured; do not block V1 on full membership RLS.
- Treat V1 metrics as operational indicators, not validated psychometric instruments.
- Keep resource content and CCI/CVR integrations outside the V1 core domain.
- Do not build organization membership UI or learner Supabase Auth accounts unless product reopens that scope.
