-- Chunks-LMS foundation schema
-- Hybrid: transactional roster/scheduling + immutable assessment lifecycle events/snapshots

create extension if not exists "pgcrypto";
-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'teacher', 'learner');
create type public.course_status as enum ('active', 'archived');
create type public.class_status as enum ('active', 'ended');
create type public.enrollment_status as enum ('active', 'ended');
create type public.schedule_status as enum ('scheduled', 'completed', 'cancelled', 'rescheduled');
create type public.attendance_status as enum ('present', 'late', 'absent', 'excused');
create type public.learning_session_status as enum ('open', 'completed');
create type public.result_color as enum ('red', 'yellow', 'green', 'purple');
create type public.attempt_status as enum (
  'draft',
  'probe_open',
  'resolution_required',
  'finalized',
  'corrected'
);
create type public.assessment_event_type as enum (
  'assessment_created',
  'provisional_recorded',
  'probe_failed',
  'probe_continued',
  'probe_completed',
  'result_finalized',
  'result_corrected'
);
create type public.metric_status as enum ('operational', 'experimental');
create type public.metric_direction as enum ('higher_better', 'lower_better', 'contextual');
-- ---------------------------------------------------------------------------
-- Identity / organization
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  clerk_org_id text unique,
  created_at timestamptz not null default now()
);
create table public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  display_name text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, role)
);
-- ---------------------------------------------------------------------------
-- Roster
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  status public.course_status not null default 'active',
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  capacity integer not null default 3 check (capacity > 0),
  teacher_user_id uuid not null references public.users (id),
  status public.class_status not null default 'active',
  created_at timestamptz not null default now()
);
-- V1: exactly one active teacher is stored as teacher_user_id (single column).
-- A partial unique index would only be needed if we modeled multi-teacher later.

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  learner_user_id uuid not null references public.users (id),
  status public.enrollment_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (class_id, learner_user_id)
);
-- Capacity enforcement for active enrollments
create or replace function public.enforce_class_capacity()
returns trigger
language plpgsql
as $$
declare
  cap integer;
  active_count integer;
begin
  select capacity into cap from public.classes where id = new.class_id;
  if new.status = 'active' then
    select count(*) into active_count
    from public.enrollments
    where class_id = new.class_id
      and status = 'active'
      and id is distinct from new.id;
    if active_count >= cap then
      raise exception 'Class is full (capacity %)', cap;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_enforce_class_capacity
before insert or update on public.enrollments
for each row execute function public.enforce_class_capacity();
-- ---------------------------------------------------------------------------
-- Scheduling & attendance
-- ---------------------------------------------------------------------------
create table public.schedule_definitions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  recurrence text not null check (recurrence in ('once', 'weekly')),
  day_of_week smallint check (day_of_week between 0 and 6),
  time_zone text not null default 'UTC',
  duration_minutes integer not null check (duration_minutes > 0),
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now()
);
create table public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  schedule_definition_id uuid references public.schedule_definitions (id),
  planned_start timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status public.schedule_status not null default 'scheduled',
  rescheduled_from_id uuid references public.scheduled_sessions (id),
  created_at timestamptz not null default now()
);
create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  scheduled_session_id uuid references public.scheduled_sessions (id),
  status public.learning_session_status not null default 'open',
  planned_question_count integer check (planned_question_count is null or planned_question_count > 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  max_probe_count integer not null default 2 check (max_probe_count > 0),
  unique (scheduled_session_id)
);
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  learning_session_id uuid not null references public.learning_sessions (id) on delete cascade,
  learner_user_id uuid not null references public.users (id),
  status public.attendance_status not null,
  recorded_at timestamptz not null default now(),
  unique (learning_session_id, learner_user_id)
);
-- ---------------------------------------------------------------------------
-- Assessment capture
-- ---------------------------------------------------------------------------
create table public.session_questions (
  id uuid primary key default gen_random_uuid(),
  learning_session_id uuid not null references public.learning_sessions (id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  external_ref text,
  created_at timestamptz not null default now(),
  unique (learning_session_id, sequence_number)
);
create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  learning_session_id uuid not null references public.learning_sessions (id) on delete cascade,
  session_question_id uuid not null references public.session_questions (id) on delete cascade,
  learner_user_id uuid not null references public.users (id),
  teacher_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  unique (session_question_id, learner_user_id)
);
-- Immutable event log
create table public.assessment_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  event_type public.assessment_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.users (id),
  created_at timestamptz not null default now()
);
create index assessment_events_attempt_idx on public.assessment_events (attempt_id, created_at);
-- Current-state snapshot (UX / realtime)
create table public.assessment_attempt_snapshots (
  attempt_id uuid primary key references public.assessment_attempts (id) on delete cascade,
  status public.attempt_status not null default 'draft',
  provisional_color public.result_color,
  effective_color public.result_color,
  effective_score smallint check (effective_score between 0 and 3),
  probe_count integer not null default 0 check (probe_count >= 0),
  max_probe_count integer not null default 2 check (max_probe_count > 0),
  entered_probe_flow boolean not null default false,
  finalized_at timestamptz,
  updated_at timestamptz not null default now()
);
-- Color score helper
create or replace function public.color_score(c public.result_color)
returns smallint
language sql
immutable
as $$
  select case c
    when 'red' then 0
    when 'yellow' then 1
    when 'green' then 2
    when 'purple' then 3
  end::smallint;
$$;
-- Atomic provisional + optional finalization / probe open
create or replace function public.record_provisional_result(
  p_attempt_id uuid,
  p_color public.result_color,
  p_actor_user_id uuid
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  snap public.assessment_attempt_snapshots;
  sess public.learning_sessions;
begin
  select ls.* into sess
  from public.assessment_attempts aa
  join public.learning_sessions ls on ls.id = aa.learning_session_id
  where aa.id = p_attempt_id
  for update of ls;

  if sess.status = 'completed' then
    raise exception 'Cannot capture on completed Learning Session';
  end if;

  select * into snap
  from public.assessment_attempt_snapshots
  where attempt_id = p_attempt_id
  for update;

  if snap is null then
    raise exception 'Snapshot missing for attempt %', p_attempt_id;
  end if;

  if snap.status <> 'draft' then
    raise exception 'Provisional result can only be recorded on draft attempt';
  end if;

  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (
    p_attempt_id,
    'provisional_recorded',
    jsonb_build_object('color', p_color),
    p_actor_user_id
  );

  if p_color = 'green' then
    update public.assessment_attempt_snapshots
    set status = 'probe_open',
        provisional_color = p_color,
        entered_probe_flow = true,
        updated_at = now()
    where attempt_id = p_attempt_id
    returning * into snap;
  else
    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (
      p_attempt_id,
      'result_finalized',
      jsonb_build_object('color', p_color),
      p_actor_user_id
    );

    update public.assessment_attempt_snapshots
    set status = 'finalized',
        provisional_color = p_color,
        effective_color = p_color,
        effective_score = public.color_score(p_color),
        finalized_at = now(),
        updated_at = now()
    where attempt_id = p_attempt_id
    returning * into snap;
  end if;

  return snap;
end;
$$;
create or replace function public.resolve_probe(
  p_attempt_id uuid,
  p_outcome text,
  p_actor_user_id uuid
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  snap public.assessment_attempt_snapshots;
  next_count integer;
  final_color public.result_color;
begin
  if p_outcome not in ('fail', 'continue', 'done') then
    raise exception 'Invalid probe outcome %', p_outcome;
  end if;

  select * into snap
  from public.assessment_attempt_snapshots
  where attempt_id = p_attempt_id
  for update;

  if snap.status not in ('probe_open', 'resolution_required') then
    raise exception 'Probe resolution requires open Green probe';
  end if;

  if p_outcome = 'fail' then
    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (p_attempt_id, 'probe_failed', '{}'::jsonb, p_actor_user_id);
    final_color := 'yellow';
    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (
      p_attempt_id,
      'result_finalized',
      jsonb_build_object('color', final_color),
      p_actor_user_id
    );
    update public.assessment_attempt_snapshots
    set status = 'finalized',
        probe_count = case when snap.status = 'probe_open' then snap.probe_count + 1 else snap.probe_count end,
        effective_color = final_color,
        effective_score = public.color_score(final_color),
        finalized_at = now(),
        updated_at = now()
    where attempt_id = p_attempt_id
    returning * into snap;
    return snap;
  end if;

  if p_outcome = 'done' then
    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (p_attempt_id, 'probe_completed', '{}'::jsonb, p_actor_user_id);
    final_color := 'green';
    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (
      p_attempt_id,
      'result_finalized',
      jsonb_build_object('color', final_color),
      p_actor_user_id
    );
    update public.assessment_attempt_snapshots
    set status = 'finalized',
        probe_count = case when snap.status = 'probe_open' then snap.probe_count + 1 else snap.probe_count end,
        effective_color = final_color,
        effective_score = public.color_score(final_color),
        finalized_at = now(),
        updated_at = now()
    where attempt_id = p_attempt_id
    returning * into snap;
    return snap;
  end if;

  -- continue
  if snap.status = 'resolution_required' then
    raise exception 'Maximum probe count reached; choose Fail or Done explicitly';
  end if;

  next_count := snap.probe_count + 1;
  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (
    p_attempt_id,
    'probe_continued',
    jsonb_build_object('probe_count', next_count),
    p_actor_user_id
  );

  update public.assessment_attempt_snapshots
  set probe_count = next_count,
      status = case when next_count >= snap.max_probe_count then 'resolution_required'::public.attempt_status
                    else 'probe_open'::public.attempt_status end,
      updated_at = now()
  where attempt_id = p_attempt_id
  returning * into snap;

  return snap;
end;
$$;
create or replace function public.correct_final_result(
  p_attempt_id uuid,
  p_color public.result_color,
  p_reason text,
  p_actor_user_id uuid
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  snap public.assessment_attempt_snapshots;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Correction requires a non-empty reason';
  end if;

  select * into snap
  from public.assessment_attempt_snapshots
  where attempt_id = p_attempt_id
  for update;

  if snap.status not in ('finalized', 'corrected') then
    raise exception 'Only finalized results can be corrected';
  end if;

  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (
    p_attempt_id,
    'result_corrected',
    jsonb_build_object(
      'color', p_color,
      'reason', p_reason,
      'previous_color', snap.effective_color
    ),
    p_actor_user_id
  );

  update public.assessment_attempt_snapshots
  set status = 'corrected',
      effective_color = p_color,
      effective_score = public.color_score(p_color),
      finalized_at = now(),
      updated_at = now()
  where attempt_id = p_attempt_id
  returning * into snap;

  return snap;
end;
$$;
-- Auto-create draft snapshot when attempt is inserted
create or replace function public.create_attempt_snapshot()
returns trigger
language plpgsql
as $$
declare
  max_p integer;
begin
  select max_probe_count into max_p
  from public.learning_sessions
  where id = new.learning_session_id;

  insert into public.assessment_attempt_snapshots (
    attempt_id, status, max_probe_count
  ) values (
    new.id, 'draft', coalesce(max_p, 2)
  );

  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (new.id, 'assessment_created', '{}'::jsonb, new.teacher_user_id);

  return new;
end;
$$;
create trigger trg_create_attempt_snapshot
after insert on public.assessment_attempts
for each row execute function public.create_attempt_snapshot();
-- ---------------------------------------------------------------------------
-- Metrics
-- ---------------------------------------------------------------------------
create table public.metric_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
create table public.metric_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.metric_templates (id) on delete cascade,
  version text not null,
  definition text not null,
  formula text not null,
  population text not null default 'finalized_attempts',
  null_behavior text not null default 'null_when_empty_denominator',
  min_sample integer not null default 1 check (min_sample >= 0),
  unit text not null,
  direction public.metric_direction not null,
  status public.metric_status not null default 'operational',
  chart_types text[] not null default array['line', 'bar'],
  created_at timestamptz not null default now(),
  unique (template_id, version)
);
insert into public.metric_templates (key, name) values
  ('rfc', 'Red/Fail Concentration'),
  ('rac', 'Ready/Awareness Concentration'),
  ('average_performance', 'Average Performance'),
  ('purple_mastery_rate', 'Purple Mastery Rate'),
  ('clarification_rate', 'Clarification Rate'),
  ('clarification_depth', 'Clarification Depth'),
  ('awareness_recovery', 'Awareness Recovery'),
  ('focus_stability', 'Focus Stability');
insert into public.metric_versions (
  template_id, version, definition, formula, min_sample, unit, direction, status
)
select t.id, '1.0.0', d.definition, d.formula, d.min_sample, d.unit, d.direction::public.metric_direction, d.status::public.metric_status
from public.metric_templates t
join (
  values
    ('rfc', '(Red + Yellow) / N', '(red+yellow)/n', 1, 'ratio', 'lower_better', 'operational'),
    ('rac', '(Green + Purple) / N', '(green+purple)/n', 1, 'ratio', 'higher_better', 'operational'),
    ('average_performance', 'mean color score 0..3', 'sum(score)/n', 1, 'score', 'higher_better', 'operational'),
    ('purple_mastery_rate', 'Purple / N', 'purple/n', 1, 'ratio', 'higher_better', 'operational'),
    ('clarification_rate', 'probed / N', 'probed/n', 1, 'ratio', 'contextual', 'operational'),
    ('clarification_depth', 'probe events / probed', 'probe_events/probed', 1, 'score', 'contextual', 'experimental'),
    ('awareness_recovery', 'recovered / probed', 'recovered/probed', 1, 'ratio', 'higher_better', 'experimental'),
    ('focus_stability', 'inverse adjacent score movement', '1 - mean_delta/3', 2, 'score', 'contextual', 'experimental')
) as d(key, definition, formula, min_sample, unit, direction, status)
  on d.key = t.key;
-- ---------------------------------------------------------------------------
-- RLS helpers (deny by default)
-- ---------------------------------------------------------------------------
create or replace function public.jwt_sub()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'sub', '');
$$;
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where clerk_user_id = public.jwt_sub() limit 1;
$$;
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_org_id
      and m.user_id = public.current_user_id()
  );
$$;
create or replace function public.has_org_role(p_org_id uuid, p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_org_id
      and m.user_id = public.current_user_id()
      and m.role = p_role
  );
$$;
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.courses enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.schedule_definitions enable row level security;
alter table public.scheduled_sessions enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.session_questions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_events enable row level security;
alter table public.assessment_attempt_snapshots enable row level security;
alter table public.metric_templates enable row level security;
alter table public.metric_versions enable row level security;
-- Self profile
create policy users_self_select on public.users
  for select using (id = public.current_user_id() or clerk_user_id = public.jwt_sub());
-- Org membership visibility
create policy org_member_select on public.organizations
  for select using (public.is_org_member(id));
create policy membership_select on public.organization_memberships
  for select using (public.is_org_member(organization_id));
create policy courses_org_select on public.courses
  for select using (public.is_org_member(organization_id));
create policy classes_select on public.classes
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = course_id and public.is_org_member(c.organization_id)
    )
  );
create policy enrollments_select on public.enrollments
  for select using (
    learner_user_id = public.current_user_id()
    or exists (
      select 1
      from public.classes cl
      join public.courses c on c.id = cl.course_id
      where cl.id = class_id
        and (
          cl.teacher_user_id = public.current_user_id()
          or public.has_org_role(c.organization_id, 'admin')
        )
    )
  );
-- Attempts: teacher of class, admin, or the learner themselves (read)
create policy attempts_select on public.assessment_attempts
  for select using (
    learner_user_id = public.current_user_id()
    or teacher_user_id = public.current_user_id()
    or exists (
      select 1
      from public.learning_sessions ls
      join public.classes cl on cl.id = ls.class_id
      join public.courses c on c.id = cl.course_id
      where ls.id = learning_session_id
        and public.has_org_role(c.organization_id, 'admin')
    )
  );
create policy snapshots_select on public.assessment_attempt_snapshots
  for select using (
    exists (
      select 1 from public.assessment_attempts aa
      where aa.id = attempt_id
        and (
          aa.learner_user_id = public.current_user_id()
          or aa.teacher_user_id = public.current_user_id()
        )
    )
  );
create policy events_select on public.assessment_events
  for select using (
    exists (
      select 1 from public.assessment_attempts aa
      where aa.id = attempt_id
        and (
          aa.learner_user_id = public.current_user_id()
          or aa.teacher_user_id = public.current_user_id()
        )
    )
  );
create policy metric_templates_read on public.metric_templates
  for select using (true);
create policy metric_versions_read on public.metric_versions
  for select using (true);
-- Realtime publication for current snapshots only
alter publication supabase_realtime add table public.assessment_attempt_snapshots;
