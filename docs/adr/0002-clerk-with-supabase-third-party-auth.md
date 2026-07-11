# Clerk with Supabase third-party authentication

Chunks-LMS will use Clerk for authentication and organization identity through Supabase’s native third-party authentication integration, with Postgres Row Level Security enforcing learner, teacher, and admin access. The deprecated Clerk Supabase JWT-template integration will not be used because it requires weaker secret-sharing and token-generation practices.
