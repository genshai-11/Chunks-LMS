<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Added principles:
  - I. Measurement Integrity and Immutable History
  - II. Explicit Module Boundaries
  - III. Database-Owned Authorization and Transitions
  - IV. Test-First Migration Discipline
  - V. Controlled and Reversible Releases
- Added sections:
  - Product and Technology Constraints
  - Development and Review Workflow
- Removed sections: none (template placeholders replaced)
- Templates updated:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
- Runtime guidance reviewed:
  - ✅ AGENTS.md
  - ✅ CONTEXT.md
  - ✅ README.md
- Deferred items: none
-->
# Chunks-LMS Constitution

## Core Principles

### I. Measurement Integrity and Immutable History
Assessment, probe, correction, package-version, measurement-snapshot, and published
resource history MUST be immutable. Only finalized or corrected results may feed learner
metrics. A visible sequence number is presentation, never stable identity. Any data reset
MUST target explicitly identified test fixtures or obsolete resource rows and MUST report
all dependent historical rows before deletion. The rationale is that learner results and
CPD provenance must remain reproducible and auditable.

### II. Explicit Module Boundaries
Live class sessions, standalone one-to-one tests, resource catalogs, generation, and
reporting MUST remain separate product modules. Standalone tests MUST NOT require a Class
or Enrollment and MUST NOT be implemented as another mode of the existing live-session
UI. Modules MAY share deep result-lifecycle behavior, but they MUST own distinct routes,
state, persistence aggregates, and authorization rules. This prevents content/resource
changes from destabilizing live observation.

### III. Database-Owned Authorization and Transitions
The database MUST enforce organization scope, learner privacy, state transitions,
immutability, and correction rules. UI callers MUST NOT independently reproduce scoring,
probe, CPD, or authorization logic. Every exposed `public` table MUST use RLS, and every
privileged function MUST have explicit EXECUTE grants, actor checks, a hardened
`search_path`, and regression tests. Service-role credentials MUST never reach browser
code. The rationale is to prevent BOLA/IDOR and inconsistent measurement behavior.

### IV. Test-First Migration Discipline
Domain rules, import validation, RLS, RPC contracts, and destructive migration guards MUST
be specified by failing tests before implementation. Importers MUST be dry-run-first,
deterministic, idempotent, hash their source, validate counts/joins/order, and surface
anomalies rather than silently normalizing them. Remote schema history MUST be reconciled
with the branch before creating a new migration. A change is incomplete until lint,
typecheck, unit/integration tests, build, OpenSpec validation, and applicable Supabase
advisors pass or the exact unavailable check is reported.

### V. Controlled and Reversible Releases
No production-impacting database, Storage, Edge Function, Hosting, or Functions command
may run without explicit approval for the reviewed artifact. Changes MUST be committed
before deployment and tagged before production. Preview/canary validation is mandatory
unless explicitly waived. Every release plan MUST contain database restore, Hosting and
Functions rollback, Edge Function source rollback, and post-deploy verification steps.
Destructive data operations require a scoped impact count and an explicit final
confirmation immediately before execution.

## Product and Technology Constraints

- The application remains a React 19 + TypeScript 6 modular monolith under `web/`.
- Supabase/Postgres is the system of record; migrations are imperative and committed under
  `supabase/migrations/`.
- Chunks-LMS measures learner Focus and Awareness; it is not a general content-authoring
  or resource-library product.
- Test Packages may own bilingual prompts, CCI/CVR inputs, CPD provenance, and approved
  narration, while assessment identity remains internal and immutable.
- CPD source inputs MUST be stored separately. Derived values MUST be reproducible from
  the recorded package version and measurement snapshot.
- Production credentials and provider responses MUST be redacted from logs and stored
  metadata.

## Development and Review Workflow

1. Work occurs on a dedicated feature branch/worktree from the approved baseline.
2. Spec Kit artifacts are the active feature workflow; the matching OpenSpec delta is
   cross-linked because repository CI validates OpenSpec.
3. Requirements proceed through specify, clarify, plan, tasks, analyze, then implement.
4. Database work begins by comparing local and remote migration history. New migration
   files are created only after that history is reconciled.
5. Tests are written before each domain, importer, RLS, and RPC implementation slice.
6. Commits remain reviewable by concern: tooling, schema reconciliation, security,
   catalog/import, runtime, reporting, and release documentation.
7. Remote destructive operations stop at a final impact/SQL review gate even when local
   implementation has been approved.

## Governance

This constitution governs feature specifications, implementation plans, tasks, reviews,
and release decisions for Chunks-LMS. Amendments require a documented rationale, a
semantic version change, propagation to dependent Spec Kit templates, and review against
`AGENTS.md`, `CONTEXT.md`, accepted ADRs, and release runbooks. MAJOR changes remove or
redefine a principle; MINOR changes add a principle or materially expand governance;
PATCH changes clarify wording without changing obligations. Every plan and PR MUST record
a Constitution Check. Unjustified violations block implementation or release.

**Version**: 1.0.0 | **Ratified**: 2026-07-19 | **Last Amended**: 2026-07-19
