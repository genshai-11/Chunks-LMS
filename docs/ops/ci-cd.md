# CI/CD for Chunks-LMS

## Pipeline overview

```text
PR opened / push
    │
    ├─► CI (always)
    │     install → lint → typecheck → unit tests → build → openspec validate
    │
    ├─► CD preview (PRs, when Vercel secrets present)
    │     build with env secrets → vercel deploy --preview
    │
    └─► CD production (main/master after CI green)
          build → vercel deploy --prod
          (DB migrations: manual promote — never auto-destructive)
```

## GitHub Actions workflows

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Quality gate on every PR and push to main |
| `.github/workflows/cd.yml` | Preview + production deploys; reuses CI as a job dependency |

## Required secrets

Configure in **GitHub → Settings → Secrets and variables → Actions**.

| Secret | Used by | Notes |
|--------|---------|--------|
| `VITE_CLERK_PUBLISHABLE_KEY` | CD build | Clerk publishable key for the target env |
| `VITE_SUPABASE_URL` | CD build | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | CD build | Supabase anon key |
| `VERCEL_TOKEN` | CD deploy | Vercel personal/org token |
| `VERCEL_ORG_ID` | CD deploy | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | CD deploy | From `.vercel/project.json` |

Optional later:

| Secret | Purpose |
|--------|---------|
| `CLERK_SECRET_KEY` | Server webhook sync (when Edge Functions exist) |
| `CLERK_WEBHOOK_SECRET` | Verify Clerk webhooks |
| `SUPABASE_ACCESS_TOKEN` | CLI linked deploys / type generation in CI |
| `SUPABASE_DB_PASSWORD` | Migration promote against hosted DB |

## Environments

Create GitHub Environments:

1. **preview** — PR deploys; optional protection rules
2. **production** — require reviewer for first production cut

## Supabase migration promotion

1. Author SQL under `supabase/migrations/`.
2. Review in PR (migrations are part of CI-reviewed code).
3. Local: `supabase start` then `supabase db reset` (applies migrations + `seed.sql`).
4. Staging: `supabase link` + `supabase db push`.
5. Production: same after staging verification.
6. **Never** drop assessment event history without an ADR.

## Clerk + Supabase third-party auth (hosted)

1. Enable Clerk third-party auth in Supabase dashboard (not JWT template).
2. Point Clerk to the Supabase project.
3. Client passes Clerk session JWT to Supabase (`Authorization: Bearer <token>`).
4. RLS uses `auth.jwt() ->> 'sub'` mapped to `users.clerk_user_id`.

See ADR `docs/adr/0002-clerk-with-supabase-third-party-auth.md`.

## Local developer flow

```bash
# App
cd web && cp .env.example .env && npm install && npm run dev

# DB (requires Supabase CLI)
supabase start
supabase db reset

# Quality (same as CI)
npm run ci   # from repo root
```

## Deploy prerequisites checklist

- [ ] Vercel project linked to `web/`
- [ ] GitHub secrets set for Clerk + Supabase + Vercel
- [ ] Supabase project created; migrations pushed
- [ ] Clerk application + organization configured
- [ ] Production environment protection enabled
