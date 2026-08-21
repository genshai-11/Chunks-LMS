---
name: cowork
description: "Standard 4-step pair programming workflow: clarify & confirm plan -> prompt subagent to implement & test -> verify local CI -> deploy Vercel Preview."
---

# Cowork Workflow (/cowork)

When the user invokes `/cowork` or starts a development task:

## Step 1: Clarify & Confirm Plan (Before touching code)
1. Analyze the codebase to understand the root cause and requirements.
2. Outline clear numbered steps and explain the technical design (impacted files, current vs proposed logic, root cause).
3. Specify the new feature/fix branch name to branch off `master`/`main`.
4. Wait for explicit user confirmation before modifying any code.

## Step 2: Branch & Subagent Delegation
1. Create the new branch from `master` (e.g. `feat/...` or `fix/...`).
2. Compose a comprehensive prompt for a specialized subagent containing architecture constraints, acceptance criteria, and TDD instructions.
3. Subagent implements changes and writes full unit tests.

## Step 3: Local CI Verification
Run the project's quality suite:
- Unit tests (`vitest` / `npm test`)
- Linter (`oxlint` / `eslint`)
- Typecheck (`tsc`)
- Production build (`vite build`)
- OpenSpec validation (if applicable)

## Step 4: PR & Vercel Preview Deployment
1. Commit changes with conventional commits.
2. Push branch to GitHub and open/update a Pull Request.
3. Verify GitHub Actions CI/CD and retrieve the Vercel Preview URL.
4. Report results to the user with the Live Preview URL and PR link.

## Production Gate
Never merge to master or trigger production deployment without explicit user approval in the current turn.
