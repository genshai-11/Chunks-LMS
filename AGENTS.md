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

**Foundation change archived** (Phase E): `openspec/changes/archive/2026-07-11-establish-lms-foundation/`.  
Main specs live under `openspec/specs/` (7 capabilities). No active change by default.

- App: `web/` (Vite + React + TS) — Admin / Teacher / Learner
- Domain + tests: roster, sessions, capture, lifecycle, metrics, reporting, ops, sync
- DB: `supabase/migrations/` + `seed.sql` (local) + `supabase/seeds/production-starter.sql` (idempotent)
- CI/CD: `.github/workflows/ci.yml`, `cd.yml`
- **Ship:** [`docs/ops/production-runbook.md`](docs/ops/production-runbook.md)

## V1 identity (product decision)

**No organization membership product for now.**

| Role | Access | Scope |
|------|--------|--------|
| **Admin** | Clerk sign-in | **Accounts** (teacher/learner active\|inactive, invites) + **Metrics** catalog (enable/label/min sample). Not courses/classes. |
| **Teacher** | Clerk sign-in | **Learner tree first** → programs/classes/seating → start session (1..N learners, pretest/posttest) → observe → analysis. |
| **Learner** | **Share link** | Profile **email** registered by Admin → invite URL `/access?email=…`. Read-only own progress. No Clerk learner account. |

- Staff maps Clerk → domain admin/teacher (allowlist / `clerk_user_id`) — **not** membership UI.
- Learner portal is read-only, scoped to the matched email profile (`activeLearnerUserId`).
- Membership, multi-org, and Clerk-for-learners are **Phase F / later**.

### Flow (current product)

```text
Home → Admin (Clerk)  accounts (active/inactive · invites) · metrics catalog · analysis
     → Teacher (Clerk) learners tree → classes/programs → start session (select HV)
                              → observe (per-learner columns / learner-first) → analysis
     → Learner (share link)   /access?email= → own attendance · analysis (enabled metrics only)
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
| Staff Clerk (Admin/Teacher gates) | ~75 | StaffGate + role allowlist; `VITE_AUTH_BYPASS` for CI |
| Learner share-link portal | ~90 | Invites + multi-enrollment class picker |
| Multi-class / teacher-owned programs | ~85 | Teacher creates program/class/seat |
| Hosted multi-user production | ~85 | Runbook + OpenSpec archive |
| **Overall V1 production readiness** | **~88** | First class shippable; live sign-off via runbook |

**Full plan (phases A–F):** [`docs/plans/lms-completion-by-role.md`](docs/plans/lms-completion-by-role.md) — still historical for A–E; product flow above is authoritative for Admin vs Teacher ownership.

**V1 “100%” definition:** Admin provisions accounts + metrics; teachers own learners/sessions/capture; learners open **email invite links** and see only own progress from **finalized real data**; multi-class teacher works; hosted course without data loss.

## Engineering constraints

- Preserve immutable assessment, probe, finalization, and correction history.
- Do not implement scoring rules independently in UI callers.
- Only finalized results feed progress metrics.
- Treat question sequence numbers as presentation, not stable identity.
- Keep learner-first and question-first as UI modes over the same domain model.
- Staff workspaces: gate with Clerk (Admin/Teacher). Learner portal: email invite scope only — never expose other learners’ rows.
- Prefer Supabase RLS for staff-backed data paths when configured; do not block V1 on full membership RLS.
- Treat V1 metrics as operational indicators, not validated psychometric instruments.
- Keep resource content and CCI/CVR integrations outside the V1 core domain.
- Do not build organization membership UI or Clerk learner accounts unless product reopens that scope.
