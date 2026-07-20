# Production runbook — first real class (Phase E)

**Purpose:** Ship and operate the first hosted Chunks-LMS course without wiping production data.

**Product identity (V1):**

| Role | Access |
|------|--------|
| Admin / Teacher | Native Supabase Auth + active database `staff_roles` |
| Learner | Scoped share link `/access?email=…` (profile email registered by staff) |

**Live app (typical):** https://chunks-lms.vercel.app  
**Repo:** https://github.com/genshai-11/Chunks-LMS

---

## 0. Preconditions checklist

- [ ] Supabase project linked; migrations applied through latest (`supabase db push`)
  - Includes: foundation, live capture, session numbers, `org_settings`, session locks
- [ ] Vercel project `chunks-lms` with Root Directory / build from `web/`
- [ ] **Production env vars** (Vercel + GitHub Actions CD):

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_SUPABASE_URL` | Yes | Hosted project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Browser-safe publishable/anon key |
| `VITE_AUTH_BYPASS` | **No** / false | Must be **off** in production |

Roles are active rows in `public.staff_roles`; Auth metadata and frontend allowlists do not authorize.

- [ ] Supabase Auth: email sign-in/up enabled; Site URL and redirects include the production domain
- [ ] Migrations **never** auto-run on deploy — use [ci-cd.md](./ci-cd.md) promote checklist

---

## 1. Deploy / redeploy

### Option A — GitHub CD

1. Push to `main` / `master` with CI green.  
2. CD deploys production when `VERCEL_*` secrets exist.  
3. Confirm deployment URL in Vercel dashboard.

### Option B — CLI

```powershell
cd C:\Users\tamha\Downloads\Lucy\Chunks-project\Chunks-LMS
vercel whoami
vercel --prod
```

Details: [vercel-deploy.md](./vercel-deploy.md).

### After deploy

1. Open production URL (no `VITE_AUTH_BYPASS`).  
2. Staff signs in with Supabase email/password or magic link.  
3. Confirm top bar shows only roles you hold (Admin / Teacher).  
4. Admin → **Integrity** → “Reload workspace” (optional) then “Run reconciliation”.

---

## 2. Seed a real org **without wiping production**

**Do not** run `supabase db reset` against production.  
**Do not** use Admin “Clear data” on a live org unless intentional.

### Preferred: create in the UI (safest)

1. Role-granted staff signs in with Supabase Auth → Admin.  
2. **Courses** → create course (e.g. `ERE-Level-B`) + auto-schedule if desired.  
3. **Classes** → create class, assign teacher, set capacity.  
4. **Students** on the class → add learners with **email** (required for portal).  
5. Copy / Email invite links.  
6. Teacher opens **Home** → **Schedule** → materialize or start Day 1.

### Optional: idempotent SQL starter

File: [`supabase/seeds/production-starter.sql`](../../supabase/seeds/production-starter.sql)

- Uses fixed UUIDs only for a **named starter org**  
- `ON CONFLICT DO NOTHING` — safe to re-run  
- **Does not** truncate or delete existing rows  

```powershell
# After supabase link to the hosted project:
# Review the file first, then:
# supabase db execute --file supabase/seeds/production-starter.sql
# or paste into Supabase SQL editor
```

Then replace demo emails/names in Admin UI with real people, or edit the SQL before apply.

---

## 3. Day-1 staff workflow

```text
Admin: Course → Class → seat learners (email) → share invite links
Teacher: Schedule → Start live session → Attendance → Observe (colors/probes) → Complete
Teacher/Admin: Analysis — confirm RFC/RAC sample size > 0
Learner: Open invite link → My classes / Attendance / Analysis (own rows only)
```

### Teacher soft lock

Starting a live session sets `ownerUserId` + `lockExpiresAt` (~5 min).  
Another browser should not steal capture while the lock is valid.

### After session

- Admin **Ops**: session completed, attendance rate  
- Admin **Attendance**: matrix cells filled  
- Admin **Audit**: finalize events (corrections if any)  
- Admin **Integrity**: reconciliation OK; optional “Rebuild ledger from cloud”

---

## 4. Hosted e2e smoke (manual) — pass/fail

Use [hosted-e2e-checklist.md](./hosted-e2e-checklist.md). Minimum gate for “first class shipped”:

| # | Step | Pass? |
|---|------|-------|
| 1 | Production URL loads; staff can Supabase sign-in and refresh without losing session | |
| 2 | Admin creates/uses one course + class + ≥1 learner with email | |
| 3 | Teacher starts Learning Session, marks attendance, records ≥1 final color | |
| 4 | Analysis shows finalized count / metrics with sample size | |
| 5 | Learner opens `/access?email=…` and sees **only** own progress | |
| 6 | Second staff browser does not wipe open session (reload still shows data) | |
| 7 | Admin Integrity reconciliation runs without unexpected divergences | |

Automated domain path (local CI): `web` Vitest `seeded-flow` + ops tests still cover lifecycle rules without the browser.

---

## 5. Rollback / incidents

| Issue | Action |
|-------|--------|
| Bad deploy | Vercel → previous deployment → Promote |
| Bad migration | Do **not** auto-revert destructive SQL; restore from Supabase backup; open ADR if events were touched |
| Empty UI after reload | Prefer **Reload workspace** / rebuild ledger — not Clear data |
| Wrong staff role | Verify `public.users.auth_user_id`, account status, and active `public.staff_roles`; do not grant through Auth metadata |
| Learner wrong data | Confirm invite email uniqueness; clear browser portal session → re-open invite |

---

## 6. Related docs

| Doc | Use |
|-----|-----|
| [supabase-auth.md](./supabase-auth.md) | Staff account, OAuth, redirect, and rollback operations |
| [ci-cd.md](./ci-cd.md) | Secrets, CD, migration promote |
| [vercel-deploy.md](./vercel-deploy.md) | First-time Vercel |
| [hosted-e2e-checklist.md](./hosted-e2e-checklist.md) | Smoke checklist |
| [../plans/lms-completion-by-role.md](../plans/lms-completion-by-role.md) | Product roadmap |
| [../../AGENTS.md](../../AGENTS.md) | Agent / identity rules |
| [../../CONTEXT.md](../../CONTEXT.md) | Domain language |

---

## 7. Human gates (always)

- Production deploy with real secrets → human confirms env  
- Money / contracts / multi-tenant go-live → out of V1  
- `supabase db reset` on production → **forbidden**  
- Clear data on production org → confirm twice  

Phase E is **complete as engineering** when: runbook exists, OpenSpec foundation archived, starter seed is non-destructive, and the hosted checklist above can be executed on production URL by staff.
