# Vercel deploy — Chunks-LMS

**Live production URL:** **https://chunks-lms.vercel.app**

| Item | Value |
|------|--------|
| Account | `genshai-11` |
| Team/scope | `genshai-11s-projects` |
| Project | `chunks-lms` |
| Project ID | `prj_OgfTGDuaohUy3yUhFTSWELUQntKR` |
| Org ID | `team_TCnNUAnsD3GkF3WkBLtoxaOW` |
| GitHub | connected to `genshai-11/Chunks-LMS` |

First production deploy completed successfully (Vite build from `web/`).

## Prerequisites

- Node 20+
- Vercel account (GitHub/Google/email): https://vercel.com/signup
- This repo built from `web/` (Vite)

## Step 1 — Install CLI

```powershell
npm install -g vercel
vercel --version
```

## Step 2 — Login

```powershell
cd C:\Users\tamha\Downloads\Lucy\Chunks-project\Chunks-LMS
vercel login
```

Complete the browser/email prompt, then:

```powershell
vercel whoami
```

## Step 3 — Link project (name: chunks-lms)

From **repo root** (uses root `vercel.json`):

```powershell
cd C:\Users\tamha\Downloads\Lucy\Chunks-project\Chunks-LMS
vercel link --yes --project chunks-lms
```

Or answer interactively:

```powershell
vercel link
# Set up "~/.../Chunks-LMS"? Y
# Which scope? (your account/team)
# Link to existing project? N (first time)
# Project name: chunks-lms
# Directory: ./
```

This creates `.vercel/project.json` with `orgId` and `projectId` (gitignored).

## Step 4 — Environment variables

App can boot in local auth-bypass mode. For native Supabase Auth:

```powershell
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production

# Also for Preview
vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_ANON_KEY preview
```

Or set in dashboard: **Project → Settings → Environment Variables**.

Local production-like build without keys:

```powershell
# optional
vercel env add VITE_AUTH_BYPASS production
# value: true
```

## Step 5 — Deploy production

```powershell
vercel --prod
```

First deploy prints URLs like:

- Production: `https://chunks-lms.vercel.app`
- Deployment: `https://chunks-lms-xxxx.vercel.app`

## Step 6 — Domain `chunks-lms`

### A) Free Vercel subdomain (recommended first)

Project name `chunks-lms` → free host:

```text
https://chunks-lms.vercel.app
```

Confirm in dashboard: **Project → Settings → Domains**.

If the name is taken, Vercel assigns `chunks-lms-<suffix>.vercel.app`. You can still add an alias:

```powershell
vercel domains add chunks-lms.vercel.app
```

(Usually automatic with project name.)

### B) Custom domain later (paid registrar)

Buy e.g. `chunks-lms.com`, then:

```powershell
vercel domains add chunks-lms.com
```

Add DNS records Vercel shows (usually A/CNAME). SSL is automatic.

## Step 7 — GitHub CD (optional)

After `vercel link`, copy IDs:

```powershell
Get-Content .vercel\project.json
```

GitHub → repo **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|--------|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `orgId` from project.json |
| `VERCEL_PROJECT_ID` | `projectId` from project.json |
| `VITE_*` | same as Vercel env |

Then pushes to `main` use `.github/workflows/cd.yml`.

## Step 8 — Supabase Auth redirects

In Supabase Dashboard → Authentication → URL Configuration, add:

- `https://chunks-lms.vercel.app/**`
- the exact Vercel Preview branch alias
- `http://localhost:5173/**`

If Google is enabled, configure the Supabase callback URL in the approved Google OAuth client and validate Preview before production.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails `tsc` | Run `npm run build --prefix web` locally first |
| Blank routes on refresh | SPA rewrite already in `vercel.json` |
| Env missing in browser | Rebuild after `vercel env add` (Vite inlines at build time) |
| Wrong root | Deploy from repo root with root `vercel.json`, not only `web/` |

## Quick one-shot (after login)

```powershell
cd C:\Users\tamha\Downloads\Lucy\Chunks-project\Chunks-LMS
vercel link --yes --project chunks-lms
vercel --prod
```
