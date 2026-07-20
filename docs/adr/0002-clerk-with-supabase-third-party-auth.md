# Clerk with Supabase third-party authentication

**Status:** Superseded by [ADR 0007](./0007-native-supabase-auth-for-staff.md) on 2026-07-20.

Chunks-LMS will use Clerk for authentication and organization identity through Supabase’s native third-party authentication integration, with Postgres Row Level Security enforcing learner, teacher, and admin access. The deprecated Clerk Supabase JWT-template integration will not be used because it requires weaker secret-sharing and token-generation practices.
