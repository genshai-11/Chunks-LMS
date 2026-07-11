# CI/CD for Chunks-LMS

> **Domain language** (Course, Learning Session, Assessment Attempt, metrics) lives in root [`CONTEXT.md`](../../CONTEXT.md).  
> This file is **ops only**: GitHub Actions, Vercel, secrets, and migration promote. CI/CD is **not** defined in `CONTEXT.md`.

## Pipeline overview

```text
PR opened / synchronize
    │
    ├─► CI (always)
    │     npm ci (web/) → openspec validate → lint → typecheck → tests → build
    │
    └─► CD preview (if VERCEL_* secrets set)
          build with VITE_* secrets → vercel deploy (preview)

push to main or master
    │
    ├─► CI (same quality gate)
    │
    └─► CD production (if VERCEL_* secrets set)
          build with VITE_* secrets → vercel deploy --prod
          (Supabase migrations: NEVER auto-applied — manual supabase db push)
```

## Workflows

| File | Triggers | Purpose |
|------|----------|---------|
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | PR + push `main`/`master` | Quality gate |
| [`.github/workflows/cd.yml`](../../.github/workflows/cd.yml) | PR → preview; push `main`/`master` → production; `workflow_dispatch` | Vercel deploy |

**App root for deploy:** `web/` (Vite). Vercel project should use **Root Directory = `web`** (or CD runs with `working-directory: web`).

**Current project link (local):** `.vercel/project.json` → project `chunks-lms`  
Typical URL: `https://chunks-lms.vercel.app` (see [vercel-deploy.md](./vercel-deploy.md)).

## Required GitHub secrets

**Repo → Settings → Secrets and variables → Actions**

| Secret | Used by | Notes |
|--------|---------|--------|
| `VITE_CLERK_PUBLISHABLE_KEY` | CD build | Clerk publishable key; leave empty only if using auth bypass |
| `VITE_SUPABASE_URL` | CD build | e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | CD build | Anon/public key (client-safe) |
| `VERCEL_TOKEN` | CD deploy | Vercel token; **if missing, deploy is skipped** (job still green) |
| `VERCEL_ORG_ID` | CD deploy | From `vercel link` / `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | CD deploy | From `.vercel/project.json` → `projectId` |

Also set the same `VITE_*` values in **Vercel project → Settings → Environment Variables** for Production (and Preview if needed), so dashboard redeploys work without GitHub.

Optional:

| Secret | Purpose |
|--------|---------|
| `CLERK_SECRET_KEY` | Server / webhooks (not in Vite client) |
| `CLERK_WEBHOOK_SECRET` | Webhook verification |
| `SUPABASE_ACCESS_TOKEN` | CLI in CI (typegen, etc.) |
| `SUPABASE_DB_PASSWORD` | Hosted DB promote |

## Environments (optional)

GitHub Environments used by CD:

1. **preview** — PR deploys  
2. **production** — production deploys (can require reviewers)

## What CI validates (product constraints)

CI does **not** load `CONTEXT.md`, but unit tests enforce domain rules described there, including:

- Immutable assessment lifecycle / corrections  
- One Assessment Attempt per Session Question (round-robin learners)  
- Only finalized results feed metrics  
- Course auto-schedule / session numbering (buổi) in scheduling modules  

Build uses `VITE_AUTH_BYPASS=true` so CI can build without real Clerk keys.

## Supabase and deploys

| Concern | Behavior |
|---------|----------|
| App data sync | **Phase D:** entity **upsert** for roster/schedule; prune only on intentional Clear data. Open learning sessions never deleted. Assessment attempts only via live capture RPCs. |
| Schema migrations | **Manual only** — never auto-applied in CD |
| Migration path | Author under `supabase/migrations/` → PR review → `supabase db push --linked` after merge |
| Integrity | Admin → **Integrity**: rebuild ledger from snapshots; event vs snapshot reconciliation |

### Migration promote checklist (hosted)

Use after every migration lands on `main`:

1. [ ] SQL reviewed (no destructive drop of `assessment_events` / snapshots without ADR).  
2. [ ] Local: `supabase db reset` (or `migration up`) green.  
3. [ ] Hosted: `supabase link --project-ref <ref>` then `supabase db push`.  
4. [ ] Confirm new columns/tables exist (e.g. `org_settings`, `learning_sessions.owner_user_id`).  
5. [ ] Smoke: staff sign-in → Admin reload workspace → Teacher start session (lock set) → Observe once → Admin Integrity check OK.  
6. [ ] **Never** run unreviewed SQL against production.

Promote steps (authoring):

1. Author SQL under `supabase/migrations/`.  
2. Include in PR (reviewed with app code).  
3. Local (optional): `supabase start` + `supabase db reset`.  
4. Hosted: `supabase link` + `supabase db push`.  
5. **Never** drop assessment event history without an ADR.

## Clerk + Supabase (production auth)

1. Enable Clerk third-party auth in Supabase (not JWT template only).  
2. Wire Clerk app to the Supabase project.  
3. Client passes Clerk session JWT to Supabase.  
4. Tighten RLS; remove foundation demo “allow all” policies before real multi-tenant production.

See `docs/adr/0002-clerk-with-supabase-third-party-auth.md`.

## Local developer flow

```bash
# App
cd web && cp .env.example .env   # fill VITE_SUPABASE_* (+ Clerk if needed)
npm install
npm run dev

# Hosted DB migrations (CLI logged in)
supabase link --project-ref <ref>
supabase db push

# Quality (same as CI)
npm run ci   # from repo root
```

## Why Vercel looked “stuck on old version”

1. Code only deploys when it is **committed and pushed** to `main`/`master` (or deployed via CLI).  
2. If `VERCEL_TOKEN` is missing, CD **skips** deploy and exits 0.  
3. After a successful deploy, hard-refresh the site (or open the deployment URL from the Actions log).

## Deploy checklist

- [ ] Vercel project linked; root directory `web/`  
- [ ] GitHub secrets: Vercel + `VITE_SUPABASE_*` (+ Clerk as needed)  
- [ ] Same `VITE_*` on Vercel env for Production  
- [ ] Supabase project exists; migrations pushed manually  
- [ ] After push to `master`, Actions → CD production is green  
- [ ] Clerk configured when leaving auth bypass  
