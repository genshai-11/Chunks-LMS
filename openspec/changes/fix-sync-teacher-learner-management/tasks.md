## 1. Foundation and diagnostics

- [x] 1.1 Add red-capable tests for Clerk-scoped workspace selection and cloud-authoritative bootstrap
- [x] 1.2 Add named sync phases and safe actionable errors
- [x] 1.3 Reproduce production sync and fix the demonstrated auth/provision/load/write cause

## 2. Identity and routing

- [x] 2.1 Add Admin allowlist configuration for `le.ntmkh@gmail.com`
- [x] 2.2 Route Teacher-only and Admin users directly to authorized workspaces
- [x] 2.3 Add authorization tests for signed-out, Teacher, Admin, and learner-link routes

## 3. Teacher learner workspace

- [x] 3.1 Add selected-Learner context within the existing selected Class
- [x] 3.2 Build visual learner cards/profile with finalized-only metrics and attendance
- [x] 3.3 Add Start session, View report, and Copy invite actions
- [x] 3.4 Preserve selected Class/Learner context in Teacher Analysis
- [x] 3.5 Add simplified add-Learner workflow from Teacher dashboard
- [x] 3.6 Add dedicated Learner profile page with editable profile, session color totals, and configurable columns
- [x] 3.7 Add list/grid learner dashboard with RFC min/max/avg by session

## 4. Teacher class management and invitations

- [x] 4.1 Add scoped Teacher class create/update/end behavior with domain tests
- [x] 4.2 Add Teacher class management UI for assigned Classes
- [x] 4.3 Add Admin People Copy and mail invitation actions for managed roles
- [x] 4.4 Verify no history is deleted when ending a Class

## 5. Assessment probe UI

- [x] 5.1 Add UI test for Fail / Pass / Done labels and outcome mapping
- [x] 5.2 Replace probe colors/glow with neutral accessible states on desktop and phone
- [x] 5.3 Update keyboard and screen-reader labels without changing RPC outcomes

## 6. Verification and deployment

- [x] 6.1 Run install, lint, typecheck, targeted tests, and full test suite
- [x] 6.2 Run production build and OpenSpec validation
- [x] 6.3 Validate/apply migrations and production environment configuration
- [x] 6.4 Add mobile icon/expand navigation, popup notifications, and tooltip titles for key metrics
- [ ] 6.5 Deploy CI/CD and verify same-account sync in two browser contexts
