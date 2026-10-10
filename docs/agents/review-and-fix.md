# Review and bug-fix workflow

## Scope and sources

Use this workflow for codebase audits and bug fixes. Read `AGENTS.md`, both canonical Ontology files, the teacher-scoped PRD, `CONTEXT.md`, and relevant ADRs. Product UX and database authorization are distinct: Admin data access does not itself require Admin course/class CRUD UI. Surface unresolved product conflicts before implementation.

## Steps and gates

1. **Baseline:** Record branch, HEAD and working tree. Run CodeGraph preflight/sync before broad source reading. Read actual CI workflows and package scripts. Done when scope and available checks are explicit.
2. **Read-only review:** Trace one behavior through UI, state/domain, client and database. Verify graph claims against source. SQL/RLS require direct inspection if not indexed. Done when each finding has file:line, expected/actual behavior, evidence, impact and confidence. Separate confirmed defects, suspected defects, documentation drift and improvements.
3. **Diagnosis:** Build and run a minimal symptom-specific repro/test. For an infrastructure incident that no longer reproduces, retain timestamped service errors and run a current health check; do not claim a live repro. Done when the failing boundary is proven or the missing evidence is reported as blocked.
4. **Approve fix:** Present root cause, acceptance criteria, impacted paths and proposed branch. Wait for explicit approval before changing product code. Preserve existing work; do not reset a branch to create a fix branch.
5. **Fix:** Write a failing regression test at the real behavior seam, apply the smallest fix, and verify the original repro. Use one PR per defect or shared root cause. Remove temporary instrumentation. Done when the regression is green and unrelated behavior is unchanged.
6. **Review and CI:** Review the diff against documented standards and originating requirements. Run checks defined by CI and scope-specific integration/browser checks. Report passed, failed and blocked separately; mocked tests do not prove hosted RLS or Storage health.
7. **Release:** Identify push/deploy impact from workflows first. Preview before production when available. Follow all `AGENTS.md` confirmation, CI, commit/tag and rollback gates. Remote SQL writes, migrations, Functions deploys and production deploys are not implied by approval to diagnose or fix locally.

## Skills by phase

| Skill | Trigger |
|---|---|
| `codegraph-advisor` | Before broad source reading/search; architecture, callers and blast radius |
| `cowork` | Primary workflow for a fix, including approval before product edits |
| `diagnosing-bugs` | Unknown root cause, intermittent failure or performance regression |
| `tdd` | Regression test and minimal behavior fix |
| `code-review` | Diff review with a fixed base SHA and spec; not a whole-repo audit |
| `supabase` | Auth, RPC, RLS, Storage, Functions, schema or migrations |
| `supabase-postgres-best-practices` | SQL/schema/transaction review or changes |
| `agent-browser` | Browser verification of affected flows |
| `writing-for-agents` | Agent instruction changes |
| `domain-modeling` | Domain terminology or decision drift |

Load only relevant skills. Use isolated reviewers when supported; otherwise report that review is sequential. SSSF is opt-in, not the default for ordinary bug fixes.

## Documentation maintenance

Keep current contracts under `docs/architecture/`, rationale/history under `docs/adr/`, plans under `docs/plans/`, operational checks under `docs/ops/`, and agent workflow under `docs/agents/`. Add links rather than duplicating rules. Keep historical decisions identifiable; do not bulk-delete or relocate documents during a bug fix.

For Tests 1-1 audio signing failures, consult the [2026-10-06 Storage diagnostic record](../ops/audio-signing-diagnosis-2026-10-06.md) for the proven failing boundary, safe recovery checks and limits.

Update both `docs/architecture/ONTOLOGY.md` and `docs/architecture/ontology.html` whenever entities, features or data flows change. Record incidents as operational evidence, not as new domain rules. A glossary remains domain vocabulary, not an incident log.
