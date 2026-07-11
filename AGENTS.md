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
- Demo: local workspace + Teacher Observe / Analysis panels (seed via Admin or tests)

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
| Role UI (CRUD / observe / analysis) | ~75 | Surfaces exist; overview pages not routed |
| Staff Clerk (Admin/Teacher gates) | ~75 | Phase A: StaffGate + role allowlist/metadata; `VITE_AUTH_BYPASS` for CI |
| Learner share-link portal | ~85 | Phase A: copy/mailto/copy-all; no first-learner leak; email required |
| Multi-class / org-wide tracking | ~35 | Teacher binds first class only; weak Admin ops |
| Hosted multi-user production | ~40 | CI/CD ready; staff Clerk not hardened |
| **Overall V1 production readiness** | **~55–60** | Foundation demo ~85% |

### Flow today

```text
Home → Admin (Clerk)  courses/classes/people/enrollments/metrics
     → Teacher (Clerk) schedule → live → observe → analysis
     → Learner (share link) /access?email= → classes → attendance → analysis
```

### Blockers to “100% V1 by role”

1. ~~Staff routes unguarded~~ — Phase A done (`StaffGate`, role-aware top bar).
2. Teacher has no class switcher (always first assigned class).
3. ~~Learner invite UX~~ — Phase A: copy / email / copy-all + unique email.
4. Admin lacks org ops board, attendance matrix, audit/correction UI.
5. Workspace full-replace sync unsafe for concurrent Admin+Teacher.
6. Overview dashboards exist as pages but are not in the router.

**Full plan (phases A–F, role matrix, tickets):** [`docs/plans/lms-completion-by-role.md`](docs/plans/lms-completion-by-role.md)

### Next product work (priority order)

| Phase | Focus | Priority |
|-------|--------|----------|
| **A** | Clerk gate Admin/Teacher + learner share-link polish (**no membership**) | P0 |
| **B** | Role homes + class/enrollment switchers; Admin analysis any class | P0 |
| **C** | Ops tracking — session board, attendance matrix, audit + post-session correction | P1 |
| **D** | Entity-level sync; ledger from finalized events; no full-replace clobber | P1 |
| **E** | Hosted e2e + runbook (staff Clerk + share links); archive OpenSpec when A–B exit | P0/P1 |
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
