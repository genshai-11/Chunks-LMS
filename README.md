# Chunks-LMS

Measurement-focused LMS for learner **Focus** and **Awareness** via teacher-observed assessments.

## Status

Foundation change `establish-lms-foundation` is **implemented** (OpenSpec tasks complete):

- React + TypeScript app under `web/` (Admin, Teacher, Learner)
- Domain modules + unit tests (lifecycle, metrics, roster, scheduling, report windows, e2e flow)
- Supabase migrations + seed
- GitHub Actions **CI** + **CD** (Vercel preview/production)
- Progress reporting with session/week/month/custom windows

**Production readiness (role tracking/management):** ~55–60%. V1 identity: **Clerk = Admin + Teacher only**; **learners = email profile + share link** (no membership). Next: staff Clerk gates, invite UX, multi-class, ops boards — see the completion plan.

## Start here

| Doc | Purpose |
|-----|---------|
| [CONTEXT.md](CONTEXT.md) | Domain glossary |
| [AGENTS.md](AGENTS.md) | Agent rules + skills + maturity summary |
| [docs/plans/lms-completion-by-role.md](docs/plans/lms-completion-by-role.md) | **Roadmap to 100% V1 by role** |
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

### Supabase (optional local DB)

```bash
# Requires Supabase CLI
supabase start
supabase db reset   # migrations + seed.sql
```

Seed creates one Organization, course `ERE-Level-B`, one Teacher, one Class (capacity 3), three Learners.

## Scripts

| Command | Where | What |
|---------|-------|------|
| `npm run dev` | root or `web/` | Vite dev server |
| `npm run test` | root | Unit tests (Vitest) |
| `npm run build` | root | Production build |
| `npm run ci` | root | OpenSpec + lint + typecheck + test + build |
| `npm run openspec:validate` | root | Validate OpenSpec change |

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
