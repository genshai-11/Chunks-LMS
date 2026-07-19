-- Separate one-to-one Test aggregate. No Class, Enrollment, scheduled session,
-- Learning Session, or Session Question foreign key is permitted in this module.

create table public.test_catalog_import_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_filename text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  status text not null default 'previewed'
    check (status in ('previewed','confirmed','running','succeeded','failed','cancelled')),
  preview_counts jsonb not null default '{}'::jsonb,
  actual_counts jsonb not null default '{}'::jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  deletion_scope jsonb not null default '{}'::jsonb,
  confirmation_token text not null,
  previewed_by_user_id uuid not null references public.users(id),
  confirmed_by_user_id uuid references public.users(id),
  previewed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  canonical_package_id uuid,
  canonical_package_version_id uuid,
  error_code text,
  error_message text
);

create table public.standalone_test_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  learner_user_id uuid not null references public.users(id),
  package_version_id uuid not null references public.test_package_versions(id),
  assigned_by_user_id uuid not null references public.users(id),
  assignment_number integer not null default 1 check (assignment_number > 0),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  unique (learner_user_id, package_version_id, assignment_number)
);

create table public.standalone_test_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null references public.standalone_test_assignments(id) on delete cascade,
  learner_user_id uuid not null references public.users(id),
  test_section_id uuid not null references public.test_sections(id),
  section_measurement_snapshot_id uuid not null references public.section_measurement_snapshots(id),
  attempt_number integer not null default 1 check (attempt_number > 0),
  prompt_language text not null check (prompt_language in ('vi','en')),
  voice_id text not null,
  intro_narration_variant_id uuid references public.narration_variants(id),
  session_number integer not null check (session_number > 0),
  target_cvr_ohm numeric not null check (target_cvr_ohm >= 0),
  cci_source_id text not null,
  cci_name text not null,
  cci_value numeric not null check (cci_value >= 0),
  item_cpd numeric generated always as (target_cvr_ohm * cci_value) stored,
  readiness_hash text,
  status text not null default 'draft'
    check (status in ('draft','ready','in_progress','completed','cancelled')),
  created_by_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  unique (assignment_id, test_section_id, attempt_number)
);

create unique index standalone_test_runs_one_open_section_idx
  on public.standalone_test_runs (assignment_id, test_section_id)
  where status in ('ready','in_progress');

create table public.standalone_test_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.standalone_test_runs(id) on delete cascade,
  test_item_id uuid not null references public.test_items(id),
  item_order integer not null check (item_order > 0),
  source_item_hash text not null,
  prompt_text text not null,
  narration_variant_id uuid not null references public.narration_variants(id),
  audio_asset_id uuid not null references public.audio_assets(id),
  target_cvr_ohm numeric not null check (target_cvr_ohm >= 0),
  cci_value numeric not null check (cci_value >= 0),
  item_cpd numeric generated always as (target_cvr_ohm * cci_value) stored,
  created_at timestamptz not null default now(),
  unique (run_id, item_order),
  unique (run_id, test_item_id)
);

create table public.standalone_test_attempts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.standalone_test_runs(id) on delete cascade,
  run_item_id uuid not null references public.standalone_test_run_items(id) on delete cascade,
  learner_user_id uuid not null references public.users(id),
  teacher_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (run_id, run_item_id)
);

create table public.standalone_test_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.standalone_test_attempts(id) on delete cascade,
  event_sequence integer not null check (event_sequence > 0),
  event_type public.assessment_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  unique (attempt_id, event_sequence)
);

create table public.standalone_test_attempt_snapshots (
  attempt_id uuid primary key references public.standalone_test_attempts(id) on delete cascade,
  status public.attempt_status not null default 'draft',
  provisional_color public.result_color,
  effective_color public.result_color,
  effective_score smallint check (effective_score between 0 and 3),
  probe_count integer not null default 0 check (probe_count >= 0),
  max_probe_count integer not null default 2 check (max_probe_count > 0),
  entered_probe_flow boolean not null default false,
  latest_event_sequence integer not null default 0 check (latest_event_sequence >= 0),
  finalized_at timestamptz,
  corrected_at timestamptz,
  updated_at timestamptz not null default now()
);

create index test_catalog_import_runs_org_status_idx
  on public.test_catalog_import_runs(organization_id, status, previewed_at desc);
create index standalone_test_assignments_learner_idx
  on public.standalone_test_assignments(learner_user_id, assigned_at desc);
create index standalone_test_runs_assignment_idx
  on public.standalone_test_runs(assignment_id, session_number, attempt_number);
create index standalone_test_run_items_run_idx
  on public.standalone_test_run_items(run_id, item_order);
create index standalone_test_attempts_run_idx
  on public.standalone_test_attempts(run_id, run_item_id);
create index standalone_test_events_attempt_idx
  on public.standalone_test_events(attempt_id, event_sequence);

create or replace function private.staff_can_manage_standalone_test(
  p_organization_id uuid,
  p_learner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.current_staff_has_role('teacher')
    and exists (
      select 1 from public.organization_memberships staff_membership
      where staff_membership.organization_id = p_organization_id
        and staff_membership.user_id = public.current_staff_user_id()
        and staff_membership.role in ('admin','teacher')
    )
    and exists (
      select 1 from public.organization_memberships learner_membership
      join public.users learner on learner.id = learner_membership.user_id
      where learner_membership.organization_id = p_organization_id
        and learner_membership.user_id = p_learner_user_id
        and learner_membership.role = 'learner'
        and learner.account_status = 'active'
    )
$$;

revoke execute on function private.staff_can_manage_standalone_test(uuid, uuid)
  from public, anon;
grant execute on function private.staff_can_manage_standalone_test(uuid, uuid)
  to authenticated, service_role;

alter table public.test_catalog_import_runs enable row level security;
alter table public.standalone_test_assignments enable row level security;
alter table public.standalone_test_runs enable row level security;
alter table public.standalone_test_run_items enable row level security;
alter table public.standalone_test_attempts enable row level security;
alter table public.standalone_test_events enable row level security;
alter table public.standalone_test_attempt_snapshots enable row level security;

create policy test_catalog_import_runs_admin_read on public.test_catalog_import_runs
  for select to authenticated using ((select public.current_staff_is_admin()));

create policy standalone_test_assignments_staff_all on public.standalone_test_assignments
  for all to authenticated
  using ((select private.staff_can_manage_standalone_test(organization_id, learner_user_id)))
  with check ((select private.staff_can_manage_standalone_test(organization_id, learner_user_id)));
create policy standalone_test_assignments_learner_read on public.standalone_test_assignments
  for select to authenticated
  using (public.current_user_id() = learner_user_id);

create policy standalone_test_runs_staff_all on public.standalone_test_runs
  for all to authenticated
  using ((select private.staff_can_manage_standalone_test(organization_id, learner_user_id)))
  with check ((select private.staff_can_manage_standalone_test(organization_id, learner_user_id)));
create policy standalone_test_runs_learner_read on public.standalone_test_runs
  for select to authenticated using (public.current_user_id() = learner_user_id);

create policy standalone_test_run_items_read on public.standalone_test_run_items
  for select to authenticated using (
    exists (
      select 1 from public.standalone_test_runs run
      where run.id = run_id
        and (
          private.staff_can_manage_standalone_test(run.organization_id, run.learner_user_id)
          or public.current_user_id() = run.learner_user_id
        )
    )
  );

create policy standalone_test_attempts_read on public.standalone_test_attempts
  for select to authenticated using (
    exists (
      select 1 from public.standalone_test_runs run
      where run.id = run_id
        and (
          private.staff_can_manage_standalone_test(run.organization_id, run.learner_user_id)
          or public.current_user_id() = run.learner_user_id
        )
    )
  );

create policy standalone_test_events_read on public.standalone_test_events
  for select to authenticated using (
    exists (
      select 1
      from public.standalone_test_attempts attempt
      join public.standalone_test_runs run on run.id = attempt.run_id
      where attempt.id = attempt_id
        and (
          private.staff_can_manage_standalone_test(run.organization_id, run.learner_user_id)
          or public.current_user_id() = run.learner_user_id
        )
    )
  );

create policy standalone_test_snapshots_read on public.standalone_test_attempt_snapshots
  for select to authenticated using (
    exists (
      select 1
      from public.standalone_test_attempts attempt
      join public.standalone_test_runs run on run.id = attempt.run_id
      where attempt.id = attempt_id
        and (
          private.staff_can_manage_standalone_test(run.organization_id, run.learner_user_id)
          or public.current_user_id() = run.learner_user_id
        )
    )
  );

-- New public tables are not automatically exposed in current hosted Supabase.
grant select on public.test_catalog_import_runs to authenticated;
grant select, insert, update on public.standalone_test_assignments to authenticated;
grant select, insert, update on public.standalone_test_runs to authenticated;
grant select on public.standalone_test_run_items to authenticated;
grant select on public.standalone_test_attempts to authenticated;
grant select on public.standalone_test_events to authenticated;
grant select on public.standalone_test_attempt_snapshots to authenticated;
grant all on all tables in schema public to service_role;

comment on table public.standalone_test_runs is
  'One Learner and one Test Section; deliberately independent of Classes and Learning Sessions.';
comment on table public.test_catalog_import_runs is
  'Audit receipt for dry-run preview and guarded replacement of obsolete test-only data.';
