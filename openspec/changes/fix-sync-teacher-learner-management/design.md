## Context

The deployed app has Clerk authentication, Supabase workspace sync, Teacher class context, Admin People CRUD, live assessment RPCs, and reporting. Production sync errors are not phase-specific, workspace bootstrap still has local/cloud ambiguity, and Teacher learner operations are split across pages. Assessment history must remain immutable and RLS remains the authorization boundary.

## Goals / Non-Goals

**Goals:**

- Deterministic Clerk-scoped cloud sync with actionable diagnostics.
- One Teacher class/learner workspace reusing existing class context and reporting.
- History-preserving Teacher class management and role-appropriate invitations.
- Neutral accessible Fail / Pass / Done probe controls.

**Non-Goals:**

- Content/resource authoring, transactional email delivery, multiple active Teachers per Class, or destructive history deletion.

## Decisions

1. **Sync is modeled as named phases.** Provision, load, write, settings, and realtime errors return a stable phase plus message. Alternative: one generic error string; rejected because it cannot form a production feedback loop.
2. **Cloud wins after first successful bootstrap.** Local state may seed only an empty Clerk-linked organization. Alternative: richness comparison; rejected because it lets demo/local data overwrite another browser.
3. **Existing class context is the single Teacher scope.** Learner selection is an additional context inside the selected Class, not a second Class selector.
4. **Selected Learner changes ordering, not domain identity.** A Learning Session remains Class-scoped; selected Learner is first in the round-robin assignment list.
5. **Teacher deletion means End when history exists.** Classes with dependent Learning Sessions or results cannot cascade-delete.
6. **Invitations are links.** Copy and `mailto:` are supported; no delivery service is introduced.
7. **Probe labels are presentation aliases.** Fail → `fail`, Pass → `continue`, Done → `done`; immutable event names and RPC contracts remain unchanged.
8. **CI/CD path.** PR/push runs OpenSpec validation, lint, typecheck, tests, build; migrations are manually pushed before Vercel production deploy.
9. **Teacher writes are command-scoped.** Existing database memberships select the Teacher workspace without rewriting role grants. Creating a Learner uses one ownership-checked transaction that creates/reuses the profile, applies multi-class/capacity rules, adds membership, and enrolls. The Teacher browser never upserts an Admin-oriented full workspace for this action.

## Risks / Trade-offs

- [Clerk third-party integration or JWT claim missing] → expose token/config phase and document dashboard setup without logging tokens.
- [Teacher class management exceeds RLS scope] → authorize by assigned Teacher/organization in Postgres and test denied cross-scope writes.
- [Assigned Class is hidden when its Course is filtered by RLS] → correlate the Course policy to the outer Course ID and test the exact policy expression.
- [Bulk sync grants Teacher excessive writes or fails midway] → use a narrow SECURITY DEFINER command with explicit ownership checks and client grants limited to `authenticated`.
- [Local bootstrap imports stale demo data] → permit it only for a newly provisioned empty organization and mark completion.
- [Pass label is semantically ambiguous] → preserve accessible description “continue probe” and document mapping.
- [Large mobile learner dashboard] → progressive disclosure and compact cards with 44px controls.

## Migration Plan

1. Add tests and diagnostics without changing data.
2. Apply any additive RLS/provisioning migration manually and validate linked parity.
3. Configure Admin allowlist in Vercel.
4. Deploy app; verify same Clerk account in two browser contexts.
5. Roll back application commit if sync regresses; additive schema remains safe.

## Open Questions

- Production signed-in error text/HAR is needed if the diagnostic seam identifies an external Clerk/Supabase dashboard configuration failure.
