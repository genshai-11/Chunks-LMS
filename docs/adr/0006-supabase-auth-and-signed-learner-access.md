---
status: accepted
supersedes: 0002-clerk-with-supabase-third-party-auth
---

# Supabase Auth with signed learner access

Chunks-LMS V2 will replace Clerk with native Supabase Auth for Admin and Teacher staff while keeping Learners as profile-only users reached through revocable, expiring signed access tokens. This supersedes the V1 Clerk third-party-auth decision because the next migration needs database-owned staff roles, complete RLS coverage, and learner access that does not create learner Auth accounts; the trade-off is a one-time identity migration and new token-management module instead of continuing the existing Clerk integration.
