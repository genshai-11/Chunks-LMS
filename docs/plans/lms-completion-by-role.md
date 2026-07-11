# LMS Completion Plan — Tracking & Management by Role

**Status:** Active roadmap (post `establish-lms-foundation`)  
**Date:** 2026-07-11  
**Goal:** Bring Chunks-LMS from foundation demo → production-usable measurement LMS, with complete tracking and management flows per role.

---

## 0. V1 identity model (product decision — locked)

**Tạm thời không dùng organization membership.** Access is split intentionally:

| Actor | How they enter | Identity source |
|-------|----------------|-----------------|
| **Admin** | Clerk sign-in | Clerk user → app role `admin` |
| **Teacher** | Clerk sign-in | Clerk user → app role `teacher` |
| **Learner** | **Share link** (no Clerk) | Learner **profile email** registered by Admin/Teacher |

### Learner access flow (V1)

1. Admin/Teacher creates learner profile with **email** (required for portal).
2. System builds invite URL: `/access?email=<registered-email>` (see `learnerInviteUrl`).
3. Staff **copies / sends that link** to the student (manual share or `mailto:` — no org membership, no Clerk learner account).
4. Learner opens link → match email on roster → set `activeLearnerUserId` → read-only portal (classes, attendance, analysis).
5. Learner may also type the same email on `/access` if they lost the link.

**Out of V1 (deferred):**

- `organization_memberships` as live auth source for all three roles
- Clerk accounts for learners
- Multi-tenant org switcher / membership UI
- Automated transactional email provider (optional later; V1 = share link)

**Security posture V1 (honest):**

- Admin/Teacher: Clerk-gated routes (staff workspace).
- Learner: **capability link + email match** — treat as low-stakes read-only progress view; do not put high-stakes or PII of other learners on this surface.
- Staff data paths still use Supabase with service/staff auth as configured; learner portal filters client-side to `activeLearnerUserId` until a stronger token model exists.

---

## 1. Current maturity assessment

| Layer | Maturity | Notes |
|-------|----------|--------|
| Domain model + ADRs | **~95%** | Glossary, invariants, hybrid events/snapshots solid |
| Domain modules + unit tests | **~90%** | Roster, scheduling, capture, lifecycle, metrics, reporting covered |
| DB schema + migrations | **~85%** | Foundation + live capture + session numbers; seed exists |
| Role UI surfaces | **~75%** | Admin / Teacher / Learner pages exist; overview routes unused |
| Staff auth (Clerk Admin/Teacher) | **~75%** | Phase A: `StaffGate`, allowlist/metadata, auth bypass for CI |
| Learner share-link portal | **~85%** | Phase A: copy / mailto / copy-all; unique email; no first-learner fallback |
| Multi-user production sync | **~40%** | Workspace full-replace sync + live assessment path; fragile for concurrent users |
| Org-wide tracking / ops | **~35%** | Metrics admin config yes; no org dashboard, no audit UI, weak multi-class |
| Hosted production readiness | **~40%** | CI/CD docs exist; Clerk for staff not hardened on hosted |

**Overall product readiness for real classes: ~55–60%.**  
**Foundation / demo readiness: ~85%.**

OpenSpec change `establish-lms-foundation` is **apply-complete** (domain + UI scaffold). “100% LMS” here means **role-complete tracking & management for V1 production**, not content-authoring (still out of scope).

---

## 2. End-to-end flow today (as implemented)

```text
Home
 ├─ Admin   (Clerk)  → Courses → Classes → People → Enrollments → Metrics
 ├─ Teacher (Clerk)  → Schedule → Live session → Observe → Analysis
 └─ Learner (share link) → /access?email=… → My classes → Attendance → Analysis
```

### Happy path (local / seeded)

1. **Admin** creates Course (optional auto-schedule), Class (teacher + capacity), learner profiles **with email**, Enrollments.
2. **Admin/Teacher** copies **invite link** per learner and shares it (chat/email).
3. **Teacher** materializes schedule, starts Learning Session, records Attendance, opens **Observe**.
4. Observe: Session Questions (round-robin learners), color capture, Green probe, optional in-session correction.
5. Session complete → finalized results enter **ledger** → Teacher/Learner **Analysis**.
6. **Learner** opens shared link → portal scoped to that email’s profile (read-only).

### Flow gaps (blocking “real” multi-role ops)

| Gap | Impact |
|-----|--------|
| Top bar role switcher has no authz | Visitors can open Admin/Teacher without Clerk role |
| Clerk does not yet hard-gate `/admin` / `/teacher` | Staff routes open in demo mode |
| Teacher always binds first matching class | Second+ class invisible |
| Learner invite UX incomplete | Need one-click copy + optional “open mail client” per seat |
| Overview pages exist but not routed | Admin/Teacher/Learner dashboards dead code |
| Post-session correction UI thin | Domain supports it; ops/admin path incomplete |
| Workspace sync = full replace | Concurrent teacher+admin edits can clobber |
| No org-level live ops board | Admin cannot track “who is teaching now / attendance / completion” |
| Audit trail not visible in UI | Events exist in DB/domain; no admin history browser |

---

## 3. Role matrix — tracking & management (target = 100% V1)

### 3.1 Admin — organization owner

| Capability | Today | Target V1 | Priority |
|------------|-------|-----------|----------|
| Courses CRUD + auto-schedule | Done | Done + archive safety | P0 keep |
| Classes + teacher + capacity | Done | Done + multi-class listing health | P0 keep |
| People (teacher/learner + avatar/email) | Done | **Email required** for learners who need portal | P0 keep |
| **Copy / send learner invite link** | Partial (copy in class panel) | One-click copy + `mailto:` with link body; bulk list | **P0** |
| Enrollments start/end | Done | Done + capacity warnings | P0 keep |
| Metric templates show/hide, min-n, probe max | Done | Persist to DB (not only local settings) | P1 |
| **Org dashboard** (counts, open sessions, at-risk) | Code exists, **not routed** | Route + live KPIs | **P0** |
| **Cross-class progress tracking** | Missing | Course/class picker → same Analysis stack | **P0** |
| **Attendance ops** (class × day matrix) | Missing | Read-only attendance board | **P1** |
| **Audit / corrections after close** | Domain only | Admin correct + reason + history list | **P1** |
| Staff role via Clerk (admin vs teacher) | Soft | Map Clerk user → admin/teacher without membership tables | **P0** |
| Org membership management UI | Deferred | Not V1 | — |
| Impersonation / “view as learner” | Missing | Optional: open portal link for that email | P2 |

### 3.2 Teacher — class operator

| Capability | Today | Target V1 | Priority |
|------------|-------|-----------|----------|
| Class schedule week view | Done | Done | P0 keep |
| Start / cancel / reschedule sessions | Done (partial) | Full lineage UX | P1 |
| Attendance capture | Done | Done + bulk present | P1 |
| Live observe (mobile-first colors/probes) | Done | Done + offline queue | P1 |
| In-session correction | Done | Done | P0 keep |
| Analysis (RFC/RAC, charts, sessions) | Done | Done | P0 keep |
| **Class switcher** (multi-class teacher) | Missing (first class only) | Required | **P0** |
| **Teacher home / overview** | Code exists, not routed | Route + next session CTA | **P0** |
| **Session history list** (completed days) | Weak | Numbered learning days + reopen read-only | **P1** |
| Realtime multi-device observe | Partial | Harden + reconnect | P1 |
| Only assigned classes (enforced) | UI soft | RLS + route guard | **P0** |

### 3.3 Learner — self progress (share-link portal)

| Capability | Today | Target V1 | Priority |
|------------|-------|-----------|----------|
| **Invite link** `/access?email=` | Done | Stable URL + copy from Admin/Teacher | **P0** |
| Type email on `/access` if link lost | Done | Done | P0 keep |
| Clerk account for learner | — | **Not in V1** | — |
| My classes / enrollments | Done | Multi-enrollment switcher | P1 |
| Attendance history | Done | Own rows only | P0 keep |
| Analysis (own results only) | Done | Always filter by `activeLearnerUserId` | **P0** |
| **Learner home / overview** | Code exists, not routed | Route + next class day | **P1** |
| Session result detail (read-only colors) | Weak / merged into analysis | Per-day breakdown | P1 |
| Notifications (session tomorrow) | Out of V1 scope | Deferred (or staff sends link again) | — |
| Compare to classmates | **Forbidden** | Keep forbidden | invariant |

---

## 4. Tracking model (what each role “tracks”)

Align product language with `CONTEXT.md`:

| Tracked object | Admin | Teacher | Learner |
|----------------|-------|---------|---------|
| Organization health | Manage | — | — |
| Course progress windows | Read all classes | Own classes | Own enrollment |
| Class capacity / seats | Manage | Read roster | — |
| Scheduled / Learning Sessions | Ops board | Own calendar + live | Own schedule (read) |
| Attendance | Ops matrix | Capture | Own history |
| Assessment Attempts / Final Results | Audit + correct | Capture + correct in session | Own finalized only |
| Metric Observations (RFC/RAC…) | Org + class | Class + learner | Self |
| Corrections / audit events | Full history | Own session history | Own corrected results (visible as latest effective) |

**Rules (unchanged engineering constraints):**

- Only **finalized** results feed metrics.
- Corrections are **append-only**; never erase history.
- Scoring rules stay in domain/DB — not reimplemented in UI.
- Learner never sees another learner’s assessment rows.
- V1 metrics are **operational indicators**, not psychometrics.

---

## 5. Phased completion plan

### Phase A — Staff Clerk + learner share links (no membership) — **P0** ✅ implemented

**Outcome:** Admin/Teacher use Clerk; learners use email invite links only. No membership product.

**Shipped:** `StaffGate`, `resolveStaffRoles` (metadata / email allowlist / bootstrap), role-aware top bar & home chips, learner copy/mailto/copy-all, unique learner email, no first-learner portal leak, `VITE_AUTH_BYPASS` for CI.

1. **Clerk gates staff only**
   - `/admin/*` requires signed-in Clerk user with app role **admin**.
   - `/teacher/*` requires signed-in Clerk user with app role **teacher** (or admin acting as staff).
   - Map Clerk user → domain user by `clerk_user_id` / allowlist config (env or simple staff table) — **not** org membership UI.
2. **Top bar:** hide Admin/Teacher for signed-out users; show only roles the staff user holds. Learner entry stays “portal / access link”, not a Clerk role chip for students.
3. **Learner portal stays share-link**
   - Keep `/access` + `/access?email=`.
   - Require unique email on learner profiles used for portal.
   - Polish: Copy invite, optional `mailto:?subject=…&body=…` with link, show “invite ready” per seat.
   - Persist `activeLearnerUserId` for that browser session only.
4. **Do not** require Clerk for `/learner/*` or force membership rows for learners.
5. Smoke tests: unsigned cannot use Admin/Teacher; learner portal only shows matched learner’s rows; staff cannot be spoofed by top-bar alone.

**Exit criteria:** Staff must Clerk sign-in; learner opens share link and sees only own progress; no membership management screens.

---

### Phase B — Role dashboards & class context — **P0** ✅ implemented

**Outcome:** Each role has a home that answers “what should I do next?” and correct scope.

**Shipped:** `/admin`, `/teacher`, `/learner` overview homes; `useTeacherClassContext` / `useLearnerClassContext` + sidebar class switcher; Admin `/admin/analysis` with class picker; invite coverage KPI; teacher home invite copy.

1. Route overview pages:
   - Admin → `/admin` overview (courses, seats, open sessions, recent results count, **invite coverage** % with email).
   - Teacher → `/teacher` overview (next scheduled, live resume, roster + **copy invites**).
   - Learner → `/learner` overview (next day, attendance, last self metrics) after valid access link.
2. **Active class context** (Teacher): class switcher in layout; persist `activeClassId`.
3. **Active enrollment context** (Learner): if multi-enrolled under same email profile, picker.
4. Admin **course/class selector** on a Progress/Analysis page (reuse `ProgressAnalysisView` in admin mode).

**Exit criteria:** Staff sign-in → role home → primary task; multi-class teacher never stuck on class[0]; invite links one-click from class roster.

---

### Phase C — Operational tracking boards — **P1** ✅ implemented

**Outcome:** Admin/Teacher can manage and audit the measurement pipeline without diving into raw tables.

**Shipped:** `/admin/ops`, `/admin/attendance`, `/admin/audit` (post-session correction + audit log), `/teacher/archive`, ops domain helpers, `org_settings` migration + metric settings sync, local auditLog persistence.

1. **Admin Ops board**
   - Today’s sessions (scheduled / open / completed).
   - Attendance completion rate per class.
   - Classes with open probe / unfinished capture.
2. **Admin Attendance matrix** — class × session day statuses.
3. **Admin Audit browser** — filter by learner/session; show event types (provisional, probe, finalize, correct).
4. **Post-session correction** — Admin (or Teacher with policy) correct effective color + required reason; append event.
5. **Teacher session archive** — completed learning days list → read-only heatmap of that day.
6. Persist metric settings + max probe count to Supabase (not only `localStorage` / client state).

**Exit criteria:** Admin can answer: “Did Day 7 for Class X finish? Who was absent? Was any result corrected?”

---

### Phase D — Data integrity & multi-user sync — **P1** ✅ implemented

**Outcome:** Concurrent use does not lose assessments or roster edits.

**Shipped:** upsert-first `saveWorkspaceToSupabase` (no prune by default; never delete open/protected sessions); `mergeScheduling` on boot/reload; soft locks (`owner_user_id` / `lock_expires_at`); ledger rebuild from snapshots; Admin `/admin/integrity` reconciliation; migration promote checklist in `docs/ops/ci-cd.md`.

1. Stop full-workspace replace as default; prefer:
   - transactional writes per entity for roster/schedule;
   - live assessment already path-oriented — make it the only write path for attempts.
2. Ledger rebuild from finalized snapshots/events (server or deterministic client projection).
3. Reconciliation diagnostics surface in Admin (event vs snapshot divergence).
4. Soft locks or “session owned by teacher” for open Learning Session.
5. Migration promote checklist verified on hosted Supabase.

**Exit criteria:** Two browsers (Admin + Teacher) can operate same org without clobbering capture.

---

### Phase E — Production ship — **P0/P1** ✅ implemented (engineering)

**Outcome:** First hosted class can run a real course.

**Shipped:**

1. Runbook: [`docs/ops/production-runbook.md`](../ops/production-runbook.md)  
2. Hosted smoke checklist: [`docs/ops/hosted-e2e-checklist.md`](../ops/hosted-e2e-checklist.md)  
3. Env matrix: [`docs/ops/env-production.md`](../ops/env-production.md)  
4. Idempotent starter seed (no wipe): [`supabase/seeds/production-starter.sql`](../../supabase/seeds/production-starter.sql)  
5. OpenSpec `establish-lms-foundation` **archived** → `openspec/changes/archive/2026-07-11-establish-lms-foundation/`; main specs under `openspec/specs/`  

**Human gate (operator):** execute hosted checklist on production URL with real Clerk + Supabase (no auth bypass).

**Exit criteria:** Real teacher completes one Learning Session on production URL; learner opens share link and sees only own progress.

---

### Phase F — Deliberately later (not V1 “100%”)

Keep **out of scope** until paid demand / second tenant:

- **Organization membership** product (multi-org, invite staff via membership, role matrix UI)
- **Clerk accounts for learners** / magic-link as authenticated subjects
- Content authoring, resource library, CCI/CVR
- Push/email provider (SendGrid etc.) for automated invites
- Multi-teacher per class
- Billing / multi-tenant marketplace
- Psychometric validation of metrics
- Parent/guardian role

---

## 6. Suggested ticket breakdown (tracer bullets)

Use `/to-tickets` after approval. Suggested order:

| ID | Ticket | Blocks |
|----|--------|--------|
| T1 | Clerk gate `/admin` + `/teacher`; role-aware top bar (staff only) | — |
| T2 | Staff identity map Clerk → domain admin/teacher (**no membership UI**) | T1 |
| T3 | Learner invite polish: copy link, mailto, require email, bulk “copy all” | — |
| T4 | Wire Overview routes for Admin/Teacher/Learner | T1 |
| T5 | Teacher active class switcher | T1 |
| T6 | Admin org progress + class picker analysis | T4 |
| T7 | Admin ops board (sessions/attendance/open capture) | T2, T6 |
| T8 | Audit browser + post-session correction UI | T2 |
| T9 | Entity-level sync (retire full replace) | T2 |
| T10 | Hosted preview e2e + runbook (staff Clerk + learner share links) | T1–T5 |

---

## 7. Definition of “100% LMS” (V1)

Chunks-LMS V1 is **complete** when:

1. **Admin** (Clerk) can provision courses/classes/people, **issue learner invite links**, configure metrics, monitor ops, audit/correct, view progress for any class.
2. **Teacher** (Clerk) can manage assigned classes end-to-end: schedule → attendance → observe → analysis, with multi-class support; can copy learner links for their class.
3. **Learner** opens a **shared email login link** (or types registered email on `/access`) and tracks only own attendance + finalized progress — **no Clerk learner account, no membership**.
4. Staff workspaces are not reachable without Clerk; learner portal never exposes other learners’ data.
5. **Tracking** is consistent: every Final Result has actor/time; every Correction has reason; metrics only from finalized population.
6. One **hosted** environment has run a real multi-session course without data loss.

Anything beyond that is V1.1+ (membership, learner Clerk, notifications, multi-teacher, content adapters).

---

## 8. Related docs

| Doc | Role |
|-----|------|
| [`CONTEXT.md`](../../CONTEXT.md) | Domain language |
| [`AGENTS.md`](../../AGENTS.md) | Agent rules + short roadmap pointer |
| [`docs/architecture/chunks-lms-architecture-review.md`](../architecture/chunks-lms-architecture-review.md) | Architecture |
| [`docs/adr/`](../adr/) | Decisions |
| [`openspec/changes/establish-lms-foundation/`](../../openspec/changes/establish-lms-foundation/) | Completed foundation change |
