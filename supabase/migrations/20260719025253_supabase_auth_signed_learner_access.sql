-- Supabase Auth staff identity and signed learner access for V2 contract ticket #5.
-- Local-only migration artifact: do not apply to remote production without the release-control ticket.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Staff identity mapping: preserve public users.id UUIDs and keep Clerk IDs only
-- as legacy migration/rollback evidence.
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null,
  add column if not exists legacy_clerk_user_id text;

update public.users
set legacy_clerk_user_id = clerk_user_id
where legacy_clerk_user_id is null
  and clerk_user_id is not null;

alter table public.users
  alter column clerk_user_id drop not null;

comment on column public.users.auth_user_id is
  'Native Supabase Auth user id for Admin/Teacher staff only; learners remain null in this version.';
comment on column public.users.legacy_clerk_user_id is
  'Migration/rollback reference only. Authorization must not depend on Clerk identifiers after V2 cutover.';
comment on column public.users.clerk_user_id is
  'Deprecated legacy Clerk subject retained temporarily for reconciliation; do not authorize from this column.';

create unique index if not exists users_auth_user_id_unique
  on public.users (auth_user_id)
  where auth_user_id is not null;
create index if not exists users_email_lower_idx
  on public.users (lower(email));

create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role public.app_role not null check (role in ('admin', 'teacher')),
  active boolean not null default true,
  granted_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, role)
);

comment on table public.staff_roles is
  'Database-owned Admin/Teacher grants for native Supabase Auth staff authorization.';
comment on column public.staff_roles.active is
  'Inactive grants keep audit/history but do not authorize staff access.';

create index if not exists staff_roles_user_active_role_idx
  on public.staff_roles (user_id, active, role);

-- Backfill staff role grants from existing membership rows, preserving history.
insert into public.staff_roles (user_id, role, active)
select distinct m.user_id, m.role, true
from public.organization_memberships m
join public.users u on u.id = m.user_id
where m.role in ('admin', 'teacher')
  and u.account_status = 'active'
on conflict (user_id, role) do update
set active = excluded.active,
    updated_at = now(),
    revoked_at = null;

create or replace function public.touch_staff_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.active then
    new.revoked_at = null;
  elsif old.active is distinct from new.active and new.revoked_at is null then
    new.revoked_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_staff_roles_updated_at on public.staff_roles;
create trigger trg_touch_staff_roles_updated_at
before update on public.staff_roles
for each row execute function public.touch_staff_roles_updated_at();

-- ---------------------------------------------------------------------------
-- Learner access tokens: raw token is returned once, only a SHA-256 hash is stored.
-- Learners do not receive auth.users rows.
-- ---------------------------------------------------------------------------
create table if not exists public.learner_access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  learner_user_id uuid not null references public.users (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  issued_by_user_id uuid not null references public.users (id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > issued_at)
);

comment on table public.learner_access_tokens is
  'Opaque signed learner access token hashes. Raw URL tokens are never persisted; learners remain profile-only.';

create index if not exists learner_access_tokens_hash_idx
  on public.learner_access_tokens (token_hash);
create index if not exists learner_access_tokens_scope_idx
  on public.learner_access_tokens (learner_user_id, class_id, expires_at)
  where revoked_at is null;
create index if not exists learner_access_tokens_issued_by_idx
  on public.learner_access_tokens (issued_by_user_id);

-- ---------------------------------------------------------------------------
-- RLS helpers. Authorization never depends on user-editable metadata or Clerk.
-- SECURITY DEFINER functions include auth.uid checks and are used from policies
-- with `(select function(...))` wrappers for Supabase RLS performance.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = (select auth.uid())
    and u.account_status = 'active'
  limit 1;
$$;

create or replace function public.current_staff_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = (select auth.uid())
    and u.account_status = 'active'
    and exists (
      select 1 from public.staff_roles sr
      where sr.user_id = u.id
        and sr.active
        and sr.role in ('admin', 'teacher')
    )
  limit 1;
$$;

create or replace function public.current_staff_has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select exists (
      select 1
      from public.staff_roles sr
      join public.users u on u.id = sr.user_id
      where u.auth_user_id = (select auth.uid())
        and u.account_status = 'active'
        and sr.active
        and (
          sr.role = p_role
          or (sr.role = 'admin' and p_role = 'teacher')
        )
    )
  ), false);
$$;

create or replace function public.current_staff_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_has_role('admin');
$$;

create or replace function public.current_teacher_owns_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select exists (
      select 1
      from public.classes cl
      where cl.id = p_class_id
        and cl.teacher_user_id = public.current_staff_user_id()
        and public.current_staff_has_role('teacher')
    )
  ), false);
$$;

create or replace function public.staff_can_read_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_is_admin() or public.current_teacher_owns_class(p_class_id);
$$;

create or replace function public.staff_can_read_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_is_admin()
    or p_user_id = public.current_staff_user_id()
    or exists (
      select 1
      from public.classes cl
      join public.enrollments e on e.class_id = cl.id
      where cl.teacher_user_id = public.current_staff_user_id()
        and e.status = 'active'
        and e.learner_user_id = p_user_id
        and public.current_staff_has_role('teacher')
    );
$$;

create or replace function public.staff_can_issue_learner_access(
  p_learner_user_id uuid,
  p_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_is_admin()
    or (
      public.current_teacher_owns_class(p_class_id)
      and exists (
        select 1
        from public.enrollments e
        join public.users learner on learner.id = e.learner_user_id
        where e.class_id = p_class_id
          and e.learner_user_id = p_learner_user_id
          and e.status = 'active'
          and learner.account_status = 'active'
      )
    );
$$;

create or replace function public.learner_access_token_hash(p_url_token text)
returns text
language sql
immutable
as $$
  select encode(digest(p_url_token, 'sha256'), 'hex');
$$;

-- Public RPC for staff (authenticated) token issuance. The raw token is emitted once.
create or replace function public.issue_learner_access_token(
  p_learner_user_id uuid,
  p_class_id uuid,
  p_ttl_seconds integer default 2592000
)
returns table (token_id uuid, url_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_id uuid := gen_random_uuid();
  v_secret text := encode(gen_random_bytes(32), 'base64');
  v_url_token text;
  v_expires_at timestamptz;
  v_actor uuid := public.current_staff_user_id();
begin
  if v_actor is null then
    raise exception 'Staff sign-in required';
  end if;

  if p_ttl_seconds is null or p_ttl_seconds < 300 or p_ttl_seconds > 7776000 then
    raise exception 'TTL must be between 5 minutes and 90 days';
  end if;

  if not public.staff_can_issue_learner_access(p_learner_user_id, p_class_id) then
    raise exception 'Not authorized to issue learner access for this scope';
  end if;

  if exists (select 1 from public.users u where u.id = p_learner_user_id and u.auth_user_id is not null) then
    raise exception 'Learner access must not be issued to a Supabase Auth account';
  end if;

  v_url_token := 'lat_' || replace(v_token_id::text, '-', '') || '_' || replace(replace(replace(v_secret, '+', '-'), '/', '_'), '=', '');
  v_expires_at := now() + make_interval(secs => p_ttl_seconds);

  insert into public.learner_access_tokens (
    id, token_hash, learner_user_id, class_id, issued_by_user_id, expires_at
  ) values (
    v_token_id,
    public.learner_access_token_hash(v_url_token),
    p_learner_user_id,
    p_class_id,
    v_actor,
    v_expires_at
  );

  return query select v_token_id, v_url_token, v_expires_at;
end;
$$;

-- Public RPC for learner entry. It returns only scoped identifiers and display fields;
-- direct anonymous table SELECT remains denied by RLS.
create or replace function public.verify_learner_access(
  p_url_token text
)
returns table (
  token_id uuid,
  learner_user_id uuid,
  class_id uuid,
  expires_at timestamptz,
  learner_display_name text,
  learner_email text,
  class_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.learner_access_tokens lat
  set last_used_at = now()
  from public.users learner
  left join public.classes cl on cl.id = lat.class_id
  where lat.token_hash = public.learner_access_token_hash(p_url_token)
    and lat.revoked_at is null
    and lat.expires_at > now()
    and learner.id = lat.learner_user_id
    and learner.account_status = 'active'
    and learner.auth_user_id is null
  returning lat.id,
    lat.learner_user_id,
    lat.class_id,
    lat.expires_at,
    learner.display_name,
    learner.email,
    cl.name;
end;
$$;

create or replace function public.learner_access_snapshot(p_url_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tok public.learner_access_tokens;
  learner public.users;
  klass public.classes;
  course public.courses;
  teacher public.users;
  enrollment_rows jsonb;
  scheduled_rows jsonb;
  learning_rows jsonb;
  attendance_rows jsonb;
  ledger_rows jsonb;
begin
  select * into tok
  from public.learner_access_tokens lat
  where lat.token_hash = public.learner_access_token_hash(p_url_token)
    and lat.revoked_at is null
    and lat.expires_at > now();

  if tok is null then
    raise exception 'Learner access link is expired, revoked, or invalid';
  end if;

  select * into learner
  from public.users u
  where u.id = tok.learner_user_id
    and u.account_status = 'active'
    and u.auth_user_id is null;
  if learner is null then
    raise exception 'Learner access is not available for this profile';
  end if;

  if tok.class_id is not null then
    select * into klass from public.classes where id = tok.class_id;
    if klass is null then
      raise exception 'Learner access class scope was not found';
    end if;
    select * into course from public.courses where id = klass.course_id;
    select * into teacher from public.users where id = klass.teacher_user_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'classId', e.class_id,
    'learnerUserId', e.learner_user_id,
    'status', e.status,
    'startedAt', e.started_at,
    'endedAt', e.ended_at
  ) order by e.started_at), '[]'::jsonb)
  into enrollment_rows
  from public.enrollments e
  where e.learner_user_id = tok.learner_user_id
    and e.status = 'active'
    and (tok.class_id is null or e.class_id = tok.class_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ss.id,
    'classId', ss.class_id,
    'plannedStart', ss.planned_start,
    'durationMinutes', ss.duration_minutes,
    'status', ss.status,
    'rescheduledFromId', ss.rescheduled_from_id,
    'sessionNumber', ss.session_number
  ) order by ss.planned_start), '[]'::jsonb)
  into scheduled_rows
  from public.scheduled_sessions ss
  where tok.class_id is not null
    and ss.class_id = tok.class_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ls.id,
    'classId', ls.class_id,
    'scheduledSessionId', ls.scheduled_session_id,
    'status', ls.status,
    'plannedQuestionCount', ls.planned_question_count,
    'startedAt', ls.started_at,
    'completedAt', ls.completed_at,
    'maxProbeCount', ls.max_probe_count,
    'sessionNumber', ls.session_number,
    'ownerUserId', ls.owner_user_id,
    'lockExpiresAt', ls.lock_expires_at,
    'sessionKind', ls.session_kind,
    'sessionFormat', ls.session_format,
    'promptLanguage', ls.prompt_language,
    'liveTestResourceId', ls.live_test_resource_id,
    'liveTestBlockId', ls.live_test_block_id,
    'participantLearnerIds', ls.participant_learner_ids
  ) order by ls.started_at), '[]'::jsonb)
  into learning_rows
  from public.learning_sessions ls
  where tok.class_id is not null
    and ls.class_id = tok.class_id
    and (
      ls.participant_learner_ids is null
      or tok.learner_user_id = any(ls.participant_learner_ids)
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ar.id,
    'learningSessionId', ar.learning_session_id,
    'learnerUserId', ar.learner_user_id,
    'status', ar.status,
    'recordedAt', ar.recorded_at
  ) order by ar.recorded_at), '[]'::jsonb)
  into attendance_rows
  from public.attendance_records ar
  join public.learning_sessions ls on ls.id = ar.learning_session_id
  where ar.learner_user_id = tok.learner_user_id
    and (tok.class_id is null or ls.class_id = tok.class_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', aa.id,
    'organizationId', c.organization_id,
    'courseId', c.id,
    'classId', cl.id,
    'learningSessionId', aa.learning_session_id,
    'learnerUserId', aa.learner_user_id,
    'teacherUserId', aa.teacher_user_id,
    'sessionQuestionId', aa.session_question_id,
    'externalRef', sq.external_ref,
    'effectiveColor', snap.effective_color,
    'enteredProbeFlow', snap.entered_probe_flow,
    'probeEventCount', snap.probe_count,
    'finalizedAt', snap.finalized_at
  ) order by snap.finalized_at), '[]'::jsonb)
  into ledger_rows
  from public.assessment_attempts aa
  join public.assessment_attempt_snapshots snap on snap.attempt_id = aa.id
  join public.session_questions sq on sq.id = aa.session_question_id
  join public.learning_sessions ls on ls.id = aa.learning_session_id
  join public.classes cl on cl.id = ls.class_id
  join public.courses c on c.id = cl.course_id
  where aa.learner_user_id = tok.learner_user_id
    and snap.finalized_at is not null
    and snap.effective_color is not null
    and (tok.class_id is null or ls.class_id = tok.class_id);

  update public.learner_access_tokens
  set last_used_at = now()
  where id = tok.id;

  return jsonb_build_object(
    'grant', jsonb_build_object(
      'tokenId', tok.id,
      'learnerUserId', tok.learner_user_id,
      'classId', tok.class_id,
      'expiresAt', tok.expires_at,
      'learnerDisplayName', learner.display_name,
      'learnerEmail', learner.email,
      'className', klass.name
    ),
    'roster', jsonb_build_object(
      'organization', jsonb_build_object('id', course.organization_id, 'name', 'Chunks Workspace'),
      'users', jsonb_build_array(
        jsonb_build_object(
          'id', learner.id,
          'displayName', learner.display_name,
          'email', learner.email,
          'avatarUrl', learner.avatar_url,
          'roles', jsonb_build_array('learner'),
          'accountStatus', learner.account_status,
          'allowMultiClass', learner.allow_multi_class
        ),
        jsonb_build_object(
          'id', teacher.id,
          'displayName', teacher.display_name,
          'email', teacher.email,
          'avatarUrl', teacher.avatar_url,
          'roles', jsonb_build_array('teacher'),
          'accountStatus', teacher.account_status,
          'allowMultiClass', teacher.allow_multi_class
        )
      ),
      'courses', jsonb_build_array(jsonb_build_object(
        'id', course.id,
        'organizationId', course.organization_id,
        'code', course.code,
        'name', course.name,
        'status', course.status
      )),
      'classes', jsonb_build_array(jsonb_build_object(
        'id', klass.id,
        'courseId', klass.course_id,
        'name', klass.name,
        'capacity', klass.capacity,
        'teacherUserId', klass.teacher_user_id,
        'status', klass.status,
        'startsOn', klass.starts_on,
        'endsOn', klass.ends_on,
        'schedule', klass.schedule
      )),
      'enrollments', enrollment_rows
    ),
    'scheduling', jsonb_build_object(
      'scheduledSessions', scheduled_rows,
      'learningSessions', learning_rows,
      'attendance', attendance_rows
    ),
    'ledger', ledger_rows
  );
end;
$$;

create or replace function public.revoke_learner_access_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tok public.learner_access_tokens;
  v_actor uuid := public.current_staff_user_id();
begin
  if v_actor is null then
    raise exception 'Staff sign-in required';
  end if;

  select * into tok from public.learner_access_tokens where id = p_token_id for update;
  if tok is null then
    raise exception 'Learner access token not found';
  end if;

  if not (public.current_staff_is_admin() or public.current_teacher_owns_class(tok.class_id)) then
    raise exception 'Not authorized to revoke learner access for this scope';
  end if;

  update public.learner_access_tokens
  set revoked_at = coalesce(revoked_at, now())
  where id = p_token_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Replace permissive Clerk/demo policies with Supabase Auth staff and learner RPCs.
-- ---------------------------------------------------------------------------
alter table public.staff_roles enable row level security;
alter table public.learner_access_tokens enable row level security;

-- Remove prior permissive demo policies and superseded Clerk-era policies.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organizations','users','organization_memberships','courses','classes','enrollments',
        'schedule_definitions','scheduled_sessions','learning_sessions','attendance_records',
        'session_questions','assessment_attempts','assessment_events','assessment_attempt_snapshots',
        'metric_templates','metric_versions','audio_assets','live_test_resources','live_test_blocks',
        'live_test_items','staff_roles','learner_access_tokens'
      )
      and (
        policyname like 'demo_all_%'
        or policyname in (
          'users_self_select','org_member_select','membership_select','courses_org_select',
          'classes_select','enrollments_select','attempts_select','snapshots_select','events_select',
          'metric_templates_read','metric_versions_read',
          'audio_assets_read','audio_assets_write','live_test_resources_read','live_test_resources_write',
          'live_test_blocks_read','live_test_blocks_write','live_test_items_read','live_test_items_write'
        )
      )
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- Users and roles.
create policy users_staff_select on public.users
  for select to authenticated
  using ((select public.staff_can_read_user(id)));
create policy users_staff_insert on public.users
  for insert to authenticated
  with check ((select public.current_staff_is_admin()) or auth_user_id = (select auth.uid()));
create policy users_staff_update on public.users
  for update to authenticated
  using ((select public.current_staff_is_admin()) or id = (select public.current_user_id()))
  with check ((select public.current_staff_is_admin()) or id = (select public.current_user_id()));

create policy staff_roles_select on public.staff_roles
  for select to authenticated
  using ((select public.current_staff_is_admin()) or user_id = (select public.current_staff_user_id()));
create policy staff_roles_admin_insert on public.staff_roles
  for insert to authenticated
  with check ((select public.current_staff_is_admin()));
create policy staff_roles_admin_update on public.staff_roles
  for update to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));
create policy staff_roles_admin_delete on public.staff_roles
  for delete to authenticated
  using ((select public.current_staff_is_admin()));

-- Singleton workspace and roster.
create policy organizations_staff_select on public.organizations
  for select to authenticated
  using ((select public.current_staff_user_id()) is not null);
create policy organizations_admin_all on public.organizations
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy memberships_staff_select on public.organization_memberships
  for select to authenticated
  using ((select public.current_staff_user_id()) is not null);
create policy memberships_admin_all on public.organization_memberships
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy courses_staff_select on public.courses
  for select to authenticated
  using (
    (select public.current_staff_is_admin())
    or exists (select 1 from public.classes cl where cl.course_id = id and (select public.current_teacher_owns_class(cl.id)))
  );
create policy courses_admin_all on public.courses
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy classes_staff_select on public.classes
  for select to authenticated
  using ((select public.staff_can_read_class(id)));
create policy classes_staff_insert on public.classes
  for insert to authenticated
  with check ((select public.current_staff_is_admin()) or teacher_user_id = (select public.current_staff_user_id()));
create policy classes_staff_update on public.classes
  for update to authenticated
  using ((select public.current_staff_is_admin()) or teacher_user_id = (select public.current_staff_user_id()))
  with check ((select public.current_staff_is_admin()) or teacher_user_id = (select public.current_staff_user_id()));
create policy classes_admin_delete on public.classes
  for delete to authenticated
  using ((select public.current_staff_is_admin()));

create policy enrollments_staff_select on public.enrollments
  for select to authenticated
  using ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)));
create policy enrollments_staff_insert on public.enrollments
  for insert to authenticated
  with check ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)));
create policy enrollments_staff_update on public.enrollments
  for update to authenticated
  using ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)))
  with check ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)));
create policy enrollments_staff_delete on public.enrollments
  for delete to authenticated
  using ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)));

-- Schedule/session/attendance.
create policy schedule_definitions_staff_all on public.schedule_definitions
  for all to authenticated
  using ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)))
  with check ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)));
create policy scheduled_sessions_staff_all on public.scheduled_sessions
  for all to authenticated
  using ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)))
  with check ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)));
create policy learning_sessions_staff_all on public.learning_sessions
  for all to authenticated
  using ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)))
  with check ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(class_id)));
create policy attendance_staff_all on public.attendance_records
  for all to authenticated
  using (
    exists (
      select 1 from public.learning_sessions ls
      where ls.id = learning_session_id
        and ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(ls.class_id)))
    )
  )
  with check (
    exists (
      select 1 from public.learning_sessions ls
      where ls.id = learning_session_id
        and ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(ls.class_id)))
    )
  );

-- Assessment lifecycle.
create policy session_questions_staff_all on public.session_questions
  for all to authenticated
  using (
    exists (
      select 1 from public.learning_sessions ls
      where ls.id = learning_session_id
        and ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(ls.class_id)))
    )
  )
  with check (
    exists (
      select 1 from public.learning_sessions ls
      where ls.id = learning_session_id
        and ((select public.current_staff_is_admin()) or (select public.current_teacher_owns_class(ls.class_id)))
    )
  );
create policy attempts_staff_all on public.assessment_attempts
  for all to authenticated
  using (
    (select public.current_staff_is_admin())
    or teacher_user_id = (select public.current_staff_user_id())
    or exists (
      select 1 from public.learning_sessions ls
      where ls.id = learning_session_id and (select public.current_teacher_owns_class(ls.class_id))
    )
  )
  with check (
    (select public.current_staff_is_admin())
    or teacher_user_id = (select public.current_staff_user_id())
    or exists (
      select 1 from public.learning_sessions ls
      where ls.id = learning_session_id and (select public.current_teacher_owns_class(ls.class_id))
    )
  );
create policy events_staff_select on public.assessment_events
  for select to authenticated
  using (
    exists (select 1 from public.assessment_attempts aa where aa.id = attempt_id)
  );
create policy snapshots_staff_select on public.assessment_attempt_snapshots
  for select to authenticated
  using (
    exists (select 1 from public.assessment_attempts aa where aa.id = attempt_id)
  );

-- Catalogs: staff only; learner access uses token RPC/read models, not direct table reads.
create policy metric_templates_staff_read on public.metric_templates
  for select to authenticated using ((select public.current_staff_user_id()) is not null);
create policy metric_versions_staff_read on public.metric_versions
  for select to authenticated using ((select public.current_staff_user_id()) is not null);

create policy audio_assets_staff_read on public.audio_assets
  for select to authenticated using ((select public.current_staff_user_id()) is not null);
create policy audio_assets_admin_write on public.audio_assets
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy live_test_resources_staff_read on public.live_test_resources
  for select to authenticated
  using ((select public.current_staff_is_admin()) or status = 'active');
create policy live_test_resources_admin_write on public.live_test_resources
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));
create policy live_test_blocks_staff_read on public.live_test_blocks
  for select to authenticated
  using (
    exists (
      select 1 from public.live_test_resources r
      where r.id = resource_id
        and ((select public.current_staff_is_admin()) or r.status = 'active')
    )
  );
create policy live_test_blocks_admin_write on public.live_test_blocks
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));
create policy live_test_items_staff_read on public.live_test_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.live_test_blocks b
      join public.live_test_resources r on r.id = b.resource_id
      where b.id = block_id
        and ((select public.current_staff_is_admin()) or r.status = 'active')
    )
  );
create policy live_test_items_admin_write on public.live_test_items
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

-- Token table is never directly visible to anon/authenticated clients.
create policy learner_access_tokens_staff_select on public.learner_access_tokens
  for select to authenticated
  using (
    (select public.current_staff_is_admin())
    or issued_by_user_id = (select public.current_staff_user_id())
    or (class_id is not null and (select public.current_teacher_owns_class(class_id)))
  );
create policy learner_access_tokens_staff_update on public.learner_access_tokens
  for update to authenticated
  using (
    (select public.current_staff_is_admin())
    or (class_id is not null and (select public.current_teacher_owns_class(class_id)))
  )
  with check (
    (select public.current_staff_is_admin())
    or (class_id is not null and (select public.current_teacher_owns_class(class_id)))
  );

-- RPC grants: anon can verify a presented token; only staff can issue/revoke.
revoke all on function public.issue_learner_access_token(uuid, uuid, integer) from public;
revoke all on function public.verify_learner_access(text) from public;
revoke all on function public.revoke_learner_access_token(uuid) from public;
revoke all on function public.learner_access_snapshot(text) from public;
grant execute on function public.issue_learner_access_token(uuid, uuid, integer) to authenticated;
grant execute on function public.verify_learner_access(text) to anon, authenticated;
grant execute on function public.learner_access_snapshot(text) to anon, authenticated;
grant execute on function public.revoke_learner_access_token(uuid) to authenticated;

-- Existing SECURITY DEFINER capture RPCs are staff-only in V2; learner token paths
-- use dedicated read-model RPCs and direct anon execution is revoked.
revoke execute on function public.create_session_question_attempt(uuid, uuid, uuid, text) from anon;
revoke execute on function public.record_provisional_result(uuid, public.result_color, uuid) from anon;
revoke execute on function public.resolve_probe(uuid, text, uuid) from anon;
revoke execute on function public.correct_final_result(uuid, public.result_color, text, uuid) from anon;
grant execute on function public.create_session_question_attempt(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.record_provisional_result(uuid, public.result_color, uuid) to authenticated;
grant execute on function public.resolve_probe(uuid, text, uuid) to authenticated;
grant execute on function public.correct_final_result(uuid, public.result_color, text, uuid) to authenticated;
