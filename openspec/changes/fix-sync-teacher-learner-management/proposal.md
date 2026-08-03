## Why

Production staff can authenticate with Clerk yet still receive a sync error or the wrong browser-local/demo workspace. Teachers also lack one coherent learner-first surface for class operation, learner reporting, invitations, and safe class management.

## What Changes

- Make Clerk-linked Supabase organization data authoritative and expose actionable sync phases/errors.
- Route Admin and Teacher accounts directly to authorized role workspaces; configure `le.ntmkh@gmail.com` as Admin.
- Add Teacher learner selection, visual learner profiles, learner-scoped reports, invite actions, and selected-learner session entry.
- Allow Teachers to create/update assigned Classes and end Classes without deleting history.
- Restore assigned Course/Class visibility under RLS and create Learners through a narrow Teacher-owned atomic enrollment command instead of Admin-oriented full-workspace sync.
- Extend Admin People management with role-appropriate Copy and mail invitation actions.
- Change sub-probe presentation to neutral **Fail / Pass / Done** buttons while preserving outcomes `fail / continue / done`.

## Capabilities

### New Capabilities

- `teacher-learner-workspace`: Learner-first Teacher class operation, learner profiles, reporting entry, invitations, and safe class management.

### Modified Capabilities

- `identity-access`: Clerk-scoped cloud workspace selection, Admin allowlist, and direct role routing.
- `course-roster`: Teacher-authorized class lifecycle and invitation management.
- `session-scheduling`: Selected Learner starts first in the Class Learning Session observation order.
- `assessment-capture`: Neutral Fail / Pass / Done probe controls and accessible interaction labels.
- `progress-reporting`: Teacher learner-profile summaries and learner-scoped report navigation.

## Impact

- React role routing, Teacher/Admin pages, class and learner context, Observe controls, and responsive styles.
- Clerk-to-Supabase token flow, organization provisioning, synchronization diagnostics, and RLS verification.
- Vercel staff allowlist configuration and existing Supabase migrations/policies.
- Tests for sync, authorization, class lifecycle, learner selection/reporting, and probe mapping.

## Non-goals and product boundary

- No content authoring, question-resource library, transactional email backend, multiple active Teachers per Class, or destructive deletion of assessment/attendance history.
- Focus and Awareness measurement remains resource-agnostic and only finalized results feed metrics.
