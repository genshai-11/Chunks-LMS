# Chunks-LMS

Measurement-focused LMS for learner **Focus** and **Awareness** via teacher-observed assessments.

## Status

Foundation OpenSpec change is **archived**; main specs under `openspec/specs/`. Phases **A–E** engineering complete for first hosted class.

- React + TypeScript app under `web/` (Admin, Teacher, Learner)
- Domain modules + unit tests (lifecycle, metrics, roster, scheduling, ops, sync, e2e)
- Supabase migrations + local `seed.sql` + idempotent `supabase/seeds/production-starter.sql`
- GitHub Actions **CI** + **CD** (Vercel)
- **Ship docs:** [production runbook](docs/ops/production-runbook.md) · [hosted e2e checklist](docs/ops/hosted-e2e-checklist.md)

**V1 identity:** Clerk = Admin + Teacher; learners = email profile + share link (no membership).

## Start here

| Doc | Purpose |
|-----|---------|
| [CONTEXT.md](CONTEXT.md) | Domain glossary |
| [AGENTS.md](AGENTS.md) | Agent rules + skills + maturity summary |
| [docs/ops/production-runbook.md](docs/ops/production-runbook.md) | **First real class — Day 1** |
| [docs/plans/lms-completion-by-role.md](docs/plans/lms-completion-by-role.md) | Roadmap A–F |
| [docs/architecture/chunks-lms-architecture-review.md](docs/architecture/chunks-lms-architecture-review.md) | Architecture |
| [docs/ops/ci-cd.md](docs/ops/ci-cd.md) | CI/CD secrets & deploy |
| [docs/adr/](docs/adr/) | Architecture decisions |

## Local development

```bash
# App
cd web
cp .env.example .env
npm install
npm run dev

# Quality (from repo root)
npm run ci
```

### Supabase (hosted or local)

```bash
# Hosted (already linked project chunks-lms / ekubetkxfcuxlyahesrl)
# web/.env:
#   VITE_SUPABASE_URL=https://ekubetkxfcuxlyahesrl.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon public key — never service_role>
supabase db push
npm run supabase:verify
# optional starter rows (idempotent):
supabase db query --linked --file supabase/seeds/production-starter.sql

# Local CLI DB instead
supabase start
supabase db reset   # migrations + seed.sql
```

See [docs/ops/supabase-connect.md](docs/ops/supabase-connect.md).

## Scripts

| Command | Where | What |
|---------|-------|------|
| `npm run dev` | root or `web/` | Vite dev server |
| `npm run test` | root | Unit tests (Vitest) |
| `npm run build` | root | Production build |
| `npm run ci` | root | OpenSpec + lint + typecheck + test + build |
| `npm run openspec:validate` | root | Validate OpenSpec specs |
| `npm run supabase:verify` | root | Ping hosted Supabase with anon key from `web/.env` |

## CI/CD & hosting

- **CI** (`.github/workflows/ci.yml`): install, lint, typecheck, tests, build, OpenSpec validate
- **CD** (`.github/workflows/cd.yml`): PR preview + `main` production via Vercel when secrets are set
- **Vercel deploy (free domain):** [docs/ops/vercel-deploy.md](docs/ops/vercel-deploy.md) → target `https://chunks-lms.vercel.app`
- Migrations are **never** auto-applied by CD — see [docs/ops/ci-cd.md](docs/ops/ci-cd.md)

### Quick Vercel (after account)

```powershell
npm install -g vercel
cd C:\Users\tamha\Downloads\Lucy\Chunks-project\Chunks-LMS
vercel login
vercel link --yes --project chunks-lms
vercel --prod
```

## Repository

Private GitHub: https://github.com/genshai-11/Chunks-LMS
