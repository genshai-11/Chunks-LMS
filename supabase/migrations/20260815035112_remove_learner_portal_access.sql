-- Remove the learner portal/share-link access surface.
-- Staff Admin/Teacher auth remains the only application entry path.

drop function if exists public.issue_learner_access_token(uuid, uuid, integer);
drop function if exists public.verify_learner_access(text);
drop function if exists public.learner_access_snapshot(text);
drop function if exists public.revoke_learner_access_token(uuid);
drop function if exists public.learner_access_token_hash(text);
drop function if exists public.staff_can_issue_learner_access(uuid, uuid);

drop table if exists public.learner_access_tokens;
