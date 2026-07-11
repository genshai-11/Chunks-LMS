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

| Role | Access | Notes |
|------|--------|--------|
| **Admin** | Clerk sign-in | Staff only |
| **Teacher** | Clerk sign-in | Staff only |
| **Learner** | **Share link** | Profile **email** registered by staff → invite URL `/access?email=…` (copy/send). No Clerk learner account. |

- Staff maps Clerk → domain admin/teacher (allowlist / `clerk_user_id`) — **not** membership UI.
- Learner portal is read-only, scoped to the matched email profile (`activeLearnerUserId`).
- Membership, multi-org, and Clerk-for-learners are **Phase F / later**.

## LMS maturity (post-foundation review)

| Layer | ~% | Reality check |
|-------|----|----------------|
| Domain + ADRs + unit tests | 90–95 | Solid measurement core |
| Role UI (CRUD / observe / analysis) | ~90 | Phase B: role homes + class context + Admin analysis |
| Staff Clerk (Admin/Teacher gates) | ~75 | Phase A: StaffGate + role allowlist/metadata; `VITE_AUTH_BYPASS` for CI |
| Learner share-link portal | ~90 | Phase A/B: invites + multi-enrollment class picker |
| Multi-class / org-wide tracking | ~80 | Phase B/C: class context + Admin ops/attendance/audit |
| Hosted multi-user production | ~85 | Phase E runbook + archived OpenSpec; human executes hosted checklist |
| **Overall V1 production readiness** | **~88** | Engineering complete for first class; live sign-off via runbook |

### Flow today

```text
Home → Admin (Clerk)  courses/classes/people/enrollments/metrics
     → Teacher (Clerk) schedule → live → observe → analysis
     → Learner (share link) /access?email= → classes → attendance → analysis
```

### Blockers to “100% V1 by role”

1. ~~Staff routes unguarded~~ — Phase A done.
2. ~~Teacher class switcher / role homes~~ — Phase B done.
3. ~~Learner invite UX~~ — Phase A; multi-enrollment picker Phase B.
4. ~~Admin ops / attendance / audit~~ — Phase C done.
5. ~~Full-replace sync clobber~~ — Phase D: upsert-only + session locks + integrity UI.

**Full plan (phases A–F, role matrix, tickets):** [`docs/plans/lms-completion-by-role.md`](docs/plans/lms-completion-by-role.md)

### Next product work (priority order)

| Phase | Focus | Priority |
|-------|--------|----------|
| **A** | Clerk gate Admin/Teacher + learner share-link polish (**no membership**) | ✅ |
| **B** | Role homes + class/enrollment switchers; Admin analysis any class | ✅ |
| **C** | Ops tracking — session board, attendance matrix, audit + post-session correction | ✅ |
| **D** | Entity-level sync; ledger from finalized events; no full-replace clobber | ✅ |
| **E** | Hosted e2e + runbook; archive OpenSpec foundation | ✅ |
| **F** | Later — membership, learner Clerk, notifications, multi-teacher, content/CCI/CVR | out of V1 |

**V1 “100%” definition:** Admin/Teacher via Clerk provision + teach + audit; learners open **email invite links** and see only own progress; multi-class teacher works; one hosted course runs without data loss. Membership is not required for V1.

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
