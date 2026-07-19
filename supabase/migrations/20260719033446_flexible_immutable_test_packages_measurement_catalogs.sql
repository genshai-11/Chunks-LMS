-- Flexible immutable Test Packages and measurement catalogs for V2 contract ticket #6.
-- Local-only migration artifact: do not apply to remote production without the release-control ticket.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Package/version/catalog foundations.
-- ---------------------------------------------------------------------------
create table if not exists public.test_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  created_by_user_id uuid references public.users (id),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, slug)
);

create table if not exists public.test_package_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.test_packages (id) on delete cascade,
  version_label text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  draft_of_version_id uuid references public.test_package_versions (id),
  snapshot_hash text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references public.users (id),
  published_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  unique (package_id, version_label),
  check ((status in ('published', 'archived')) = (published_at is not null)),
  check (status <> 'published' or snapshot_hash is not null)
);

create table if not exists public.cci_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  version_label text not null default '1.0.0',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  description text,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, name, version_label)
);

create table if not exists public.cci_categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.cci_profiles (id) on delete cascade,
  category_order integer not null check (category_order > 0),
  label text not null,
  value numeric not null check (value >= 0),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, category_order),
  unique (profile_id, label)
);

create table if not exists public.test_sections (
  id uuid primary key default gen_random_uuid(),
  package_version_id uuid not null references public.test_package_versions (id) on delete cascade,
  section_order integer not null check (section_order > 0),
  title text,
  target_cvr_ohm numeric check (target_cvr_ohm is null or target_cvr_ohm >= 0),
  cci_profile_id uuid references public.cci_profiles (id),
  cci_category_id uuid references public.cci_categories (id),
  cci_snapshot jsonb not null default '{}'::jsonb,
  intro_text_vi text,
  intro_text_en text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_version_id, section_order)
);

create table if not exists public.section_measurement_snapshots (
  id uuid primary key default gen_random_uuid(),
  test_section_id uuid not null references public.test_sections (id) on delete cascade,
  package_version_id uuid not null references public.test_package_versions (id) on delete cascade,
  target_cvr_ohm numeric not null check (target_cvr_ohm >= 0),
  cci_profile_id uuid not null references public.cci_profiles (id),
  cci_category_id uuid not null references public.cci_categories (id),
  cci_category_label text not null,
  cci_value numeric not null check (cci_value >= 0),
  snapshot_metadata jsonb not null default '{}'::jsonb,
  supersedes_snapshot_id uuid references public.section_measurement_snapshots (id),
  override_reason text,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  check ((supersedes_snapshot_id is null and override_reason is null) or (supersedes_snapshot_id is not null and override_reason is not null))
);

create table if not exists public.test_items (
  id uuid primary key default gen_random_uuid(),
  package_version_id uuid not null references public.test_package_versions (id) on delete cascade,
  section_id uuid not null references public.test_sections (id) on delete cascade,
  item_order integer not null check (item_order > 0),
  source_day text,
  source_stt text,
  term_vi text,
  term_en text,
  prompt_vi text,
  prompt_en text,
  tc numeric check (tc is null or tc >= 0),
  lc numeric check (lc is null or lc >= 0),
  tl numeric check (tl is null or tl >= 0),
  measured_cvr numeric generated always as (
    case when tc is null or lc is null or tl is null then null else tc * lc * tl end
  ) stored,
  cvr_breakdown jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, item_order)
);

-- Add package/snapshot identity to sessions while preserving old live_test_* columns
-- until hosted-data migration (#7) maps existing records.
alter table public.learning_sessions
  add column if not exists test_package_version_id uuid null references public.test_package_versions (id),
  add column if not exists test_section_id uuid null references public.test_sections (id),
  add column if not exists section_measurement_snapshot_id uuid null references public.section_measurement_snapshots (id);

alter table public.learning_sessions
  drop constraint if exists learning_sessions_lesson_test_shape;

alter table public.learning_sessions
  add constraint learning_sessions_lesson_test_shape check (
    (
      session_format = 'lesson'
      and prompt_language is null
      and live_test_resource_id is null
      and live_test_block_id is null
      and test_package_version_id is null
      and test_section_id is null
      and section_measurement_snapshot_id is null
    )
    or
    (
      session_format = 'test'
      and prompt_language is not null
      and (
        (live_test_resource_id is not null and live_test_block_id is not null)
        or
        (test_package_version_id is not null and test_section_id is not null and section_measurement_snapshot_id is not null)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Narration/audio/generation storage foundations. Generation behavior is #8;
-- this ticket only creates durable audit structures.
-- ---------------------------------------------------------------------------
alter table public.audio_assets
  add column if not exists visibility text not null default 'private' check (visibility in ('private', 'public')),
  add column if not exists bytes integer check (bytes is null or bytes >= 0),
  add column if not exists source_kind text check (source_kind is null or source_kind in ('custom_upload', 'generated_tts', 'legacy_import')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.narration_variants (
  id uuid primary key default gen_random_uuid(),
  package_version_id uuid not null references public.test_package_versions (id) on delete cascade,
  test_section_id uuid references public.test_sections (id) on delete cascade,
  test_item_id uuid references public.test_items (id) on delete cascade,
  narration_target text not null check (narration_target in ('section_intro', 'test_item')),
  language text not null check (language in ('vi', 'en')),
  voice_id text not null,
  voice_label text,
  source_text_hash text not null,
  provider_metadata jsonb not null default '{}'::jsonb,
  audio_asset_id uuid references public.audio_assets (id),
  approval_status text not null default 'draft' check (approval_status in ('draft', 'generated', 'approved', 'rejected', 'archived')),
  approved_by_user_id uuid references public.users (id),
  approved_at timestamptz,
  generation_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (narration_target = 'section_intro' and test_section_id is not null and test_item_id is null)
    or
    (narration_target = 'test_item' and test_item_id is not null and test_section_id is null)
  ),
  check ((approval_status = 'approved') = (approved_at is not null))
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requested_by_user_id uuid references public.users (id),
  package_version_id uuid references public.test_package_versions (id) on delete cascade,
  test_section_id uuid references public.test_sections (id) on delete cascade,
  test_item_id uuid references public.test_items (id) on delete cascade,
  narration_variant_id uuid references public.narration_variants (id) on delete set null,
  job_type text not null check (job_type in ('test_item', 'section_intro_narration', 'item_narration')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  prompt_hash text,
  source_hash text,
  provider_metadata jsonb not null default '{}'::jsonb,
  attempts jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.narration_variants
  drop constraint if exists narration_variants_generation_job_id_fkey;
alter table public.narration_variants
  add constraint narration_variants_generation_job_id_fkey
  foreign key (generation_job_id) references public.generation_jobs (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Draft mutability vs published-version immutability.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.freeze_published_package_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Published Package Versions are immutable';
    end if;
    return old;
  end if;

  if old.status <> 'draft' then
    if old.status = 'published'
      and new.status = 'archived'
      and new.package_id is not distinct from old.package_id
      and new.version_label is not distinct from old.version_label
      and new.draft_of_version_id is not distinct from old.draft_of_version_id
      and new.snapshot_hash is not distinct from old.snapshot_hash
      and new.source_metadata is not distinct from old.source_metadata
      and new.created_by_user_id is not distinct from old.created_by_user_id
      and new.published_by_user_id is not distinct from old.published_by_user_id
      and new.created_at is not distinct from old.created_at
      and new.published_at is not distinct from old.published_at
    then
      new.archived_at = coalesce(new.archived_at, now());
      new.updated_at = now();
      return new;
    end if;
    raise exception 'Published Package Versions are immutable';
  end if;

  if new.status = 'published' then
    new.published_at = coalesce(new.published_at, now());
  end if;
  if new.status = 'archived' then
    new.archived_at = coalesce(new.archived_at, now());
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.require_draft_test_package_version(p_package_version_id uuid)
returns void
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.test_package_versions
  where id = p_package_version_id;

  if v_status is null then
    raise exception 'Package Version not found';
  end if;

  if v_status <> 'draft' then
    raise exception 'Published Package Versions are immutable';
  end if;
end;
$$;

create or replace function public.ensure_section_parent_version_is_draft()
returns trigger
language plpgsql
as $$
declare
  v_package_version_id uuid;
begin
  v_package_version_id := case when tg_op = 'DELETE' then old.package_version_id else new.package_version_id end;
  perform public.require_draft_test_package_version(v_package_version_id);
  if tg_op in ('INSERT', 'UPDATE') then
    new.updated_at = now();
    return new;
  end if;
  return old;
end;
$$;

create or replace function public.ensure_item_parent_version_is_draft()
returns trigger
language plpgsql
as $$
declare
  v_package_version_id uuid;
  v_section_version_id uuid;
begin
  v_package_version_id := case when tg_op = 'DELETE' then old.package_version_id else new.package_version_id end;
  perform public.require_draft_test_package_version(v_package_version_id);

  if tg_op in ('INSERT', 'UPDATE') then
    select package_version_id into v_section_version_id
    from public.test_sections
    where id = new.section_id;

    if v_section_version_id is distinct from new.package_version_id then
      raise exception 'Test Item Package Version must match its Test Section Package Version';
    end if;

    new.updated_at = now();
    return new;
  end if;
  return old;
end;
$$;

create or replace function public.ensure_cci_profile_is_draft()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_profile_id uuid;
begin
  v_profile_id := case when tg_op = 'DELETE' then old.profile_id else new.profile_id end;
  select status into v_status
  from public.cci_profiles
  where id = v_profile_id;

  if v_status <> 'draft' then
    raise exception 'Active CCI Profiles are immutable; create a new profile version instead';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new.updated_at = now();
    return new;
  end if;
  return old;
end;
$$;

create or replace function public.prevent_measurement_snapshot_rewrite()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_section_version_id uuid;
  v_category_profile_id uuid;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Section measurement snapshots are immutable';
  end if;

  select status into v_status
  from public.test_package_versions
  where id = new.package_version_id;

  if v_status is null then
    raise exception 'Package Version not found';
  end if;

  select package_version_id into v_section_version_id
  from public.test_sections
  where id = new.test_section_id;

  if v_section_version_id is distinct from new.package_version_id then
    raise exception 'Measurement snapshot Package Version must match its Test Section Package Version';
  end if;

  select profile_id into v_category_profile_id
  from public.cci_categories
  where id = new.cci_category_id;

  if v_category_profile_id is distinct from new.cci_profile_id then
    raise exception 'CCI Category must belong to the selected CCI Profile';
  end if;

  if v_status <> 'draft' and (new.supersedes_snapshot_id is null or new.override_reason is null) then
    raise exception 'Published measurement changes require an override snapshot';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_narration_parent_version_is_draft()
returns trigger
language plpgsql
as $$
declare
  v_package_version_id uuid;
begin
  v_package_version_id := case when tg_op = 'DELETE' then old.package_version_id else new.package_version_id end;
  perform public.require_draft_test_package_version(v_package_version_id);
  if tg_op in ('INSERT', 'UPDATE') then
    new.updated_at = now();
    return new;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_touch_test_packages_updated_at on public.test_packages;
create trigger trg_touch_test_packages_updated_at
before update on public.test_packages
for each row execute function public.touch_updated_at();

drop trigger if exists trg_freeze_published_package_version on public.test_package_versions;
create trigger trg_freeze_published_package_version
before update or delete on public.test_package_versions
for each row execute function public.freeze_published_package_version();

drop trigger if exists trg_touch_cci_profiles_updated_at on public.cci_profiles;
create trigger trg_touch_cci_profiles_updated_at
before update on public.cci_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_ensure_cci_profile_is_draft on public.cci_categories;
create trigger trg_ensure_cci_profile_is_draft
before insert or update or delete on public.cci_categories
for each row execute function public.ensure_cci_profile_is_draft();

drop trigger if exists trg_ensure_section_parent_version_is_draft on public.test_sections;
create trigger trg_ensure_section_parent_version_is_draft
before insert or update or delete on public.test_sections
for each row execute function public.ensure_section_parent_version_is_draft();

drop trigger if exists trg_prevent_measurement_snapshot_rewrite on public.section_measurement_snapshots;
create trigger trg_prevent_measurement_snapshot_rewrite
before insert or update or delete on public.section_measurement_snapshots
for each row execute function public.prevent_measurement_snapshot_rewrite();

drop trigger if exists trg_ensure_item_parent_version_is_draft on public.test_items;
create trigger trg_ensure_item_parent_version_is_draft
before insert or update or delete on public.test_items
for each row execute function public.ensure_item_parent_version_is_draft();

drop trigger if exists trg_ensure_narration_parent_version_is_draft on public.narration_variants;
create trigger trg_ensure_narration_parent_version_is_draft
before insert or update or delete on public.narration_variants
for each row execute function public.ensure_narration_parent_version_is_draft();

drop trigger if exists trg_touch_generation_jobs_updated_at on public.generation_jobs;
create trigger trg_touch_generation_jobs_updated_at
before update on public.generation_jobs
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes for runtime lookup, immutable external-ref resolution, and RLS paths.
-- ---------------------------------------------------------------------------
create index if not exists test_packages_org_slug_idx
  on public.test_packages (organization_id, slug);
create index if not exists test_package_versions_package_status_idx
  on public.test_package_versions (package_id, status, version_label);
create index if not exists cci_profiles_org_status_idx
  on public.cci_profiles (organization_id, status, name);
create index if not exists cci_categories_profile_order_idx
  on public.cci_categories (profile_id, category_order);
create index if not exists test_sections_version_order_idx
  on public.test_sections (package_version_id, section_order);
create index if not exists section_measurement_snapshots_section_created_idx
  on public.section_measurement_snapshots (test_section_id, created_at desc);
create index if not exists test_items_section_order_idx
  on public.test_items (section_id, item_order);
create index if not exists test_items_version_idx
  on public.test_items (package_version_id);
create index if not exists learning_sessions_test_package_idx
  on public.learning_sessions (test_package_version_id, test_section_id, section_measurement_snapshot_id)
  where test_package_version_id is not null;
create index if not exists narration_variants_section_idx
  on public.narration_variants (test_section_id, language, voice_id)
  where narration_target = 'section_intro';
create index if not exists narration_variants_item_idx
  on public.narration_variants (test_item_id, language, voice_id)
  where narration_target = 'test_item';
create index if not exists generation_jobs_context_idx
  on public.generation_jobs (package_version_id, status, requested_at desc);

-- ---------------------------------------------------------------------------
-- RLS: Admin manages drafts/catalogs. Teachers read published/archived package
-- data needed by assigned sessions. Learners use later token read models only.
-- ---------------------------------------------------------------------------
alter table public.test_packages enable row level security;
alter table public.test_package_versions enable row level security;
alter table public.cci_profiles enable row level security;
alter table public.cci_categories enable row level security;
alter table public.test_sections enable row level security;
alter table public.section_measurement_snapshots enable row level security;
alter table public.test_items enable row level security;
alter table public.narration_variants enable row level security;
alter table public.generation_jobs enable row level security;

create policy test_packages_staff_read on public.test_packages
  for select to authenticated
  using (
    (select public.current_staff_is_admin())
    or exists (
      select 1 from public.test_package_versions v
      where v.package_id = id and v.status in ('published', 'archived')
    )
  );
create policy test_packages_admin_all on public.test_packages
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy test_package_versions_staff_read on public.test_package_versions
  for select to authenticated
  using ((select public.current_staff_is_admin()) or status in ('published', 'archived'));
create policy test_package_versions_admin_all on public.test_package_versions
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy cci_profiles_staff_read on public.cci_profiles
  for select to authenticated
  using ((select public.current_staff_is_admin()) or status in ('active', 'archived'));
create policy cci_profiles_admin_all on public.cci_profiles
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy cci_categories_staff_read on public.cci_categories
  for select to authenticated
  using (
    exists (
      select 1 from public.cci_profiles p
      where p.id = profile_id and ((select public.current_staff_is_admin()) or p.status in ('active', 'archived'))
    )
  );
create policy cci_categories_admin_all on public.cci_categories
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy test_sections_staff_read on public.test_sections
  for select to authenticated
  using (
    exists (
      select 1 from public.test_package_versions v
      where v.id = package_version_id and ((select public.current_staff_is_admin()) or v.status in ('published', 'archived'))
    )
  );
create policy test_sections_admin_all on public.test_sections
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy section_measurement_snapshots_staff_read on public.section_measurement_snapshots
  for select to authenticated
  using (
    exists (
      select 1 from public.test_package_versions v
      where v.id = package_version_id and ((select public.current_staff_is_admin()) or v.status in ('published', 'archived'))
    )
  );
create policy section_measurement_snapshots_admin_all on public.section_measurement_snapshots
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy test_items_staff_read on public.test_items
  for select to authenticated
  using (
    exists (
      select 1 from public.test_package_versions v
      where v.id = package_version_id and ((select public.current_staff_is_admin()) or v.status in ('published', 'archived'))
    )
  );
create policy test_items_admin_all on public.test_items
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy narration_variants_staff_read on public.narration_variants
  for select to authenticated
  using (
    (select public.current_staff_is_admin())
    or (
      approval_status = 'approved'
      and exists (
        select 1 from public.test_package_versions v
        where v.id = package_version_id and v.status in ('published', 'archived')
      )
    )
  );
create policy narration_variants_admin_all on public.narration_variants
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy generation_jobs_admin_all on public.generation_jobs
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

-- Explicit grants for new tables because recent Supabase projects do not expose
-- new public tables to Data API roles automatically. RLS still controls rows.
grant select, insert, update, delete on
  public.test_packages,
  public.test_package_versions,
  public.cci_profiles,
  public.cci_categories,
  public.test_sections,
  public.section_measurement_snapshots,
  public.test_items,
  public.narration_variants,
  public.generation_jobs
  to authenticated;

-- No anon direct table grants for package/catalog/audio/generation foundations.

comment on table public.test_packages is
  'Admin-managed Live Test Package containers in the singleton Chunks Workspace.';
comment on table public.test_package_versions is
  'Mutable only while draft; published Package Versions freeze section/item/narration snapshots for historical sessions.';
comment on table public.test_sections is
  'Flexible ordered Test Sections within a Package Version; target_cvr_ohm is section-level measurement target.';
comment on table public.section_measurement_snapshots is
  'Immutable section measurement snapshots. Overrides create new rows and preserve historical snapshot identities.';
comment on table public.test_items is
  'Flexible ordered Test Items with item-level TC/LC/TL validation; measured_cvr is TC x LC x TL.';
comment on table public.narration_variants is
  'Section intro and item narration variants with independent language/voice/audio approval state.';
comment on table public.generation_jobs is
  'Auditable generation job records for later #8 server-side 9Router/TTS behavior; no provider secrets allowed.';
comment on column public.learning_sessions.test_package_version_id is
  'Immutable Package Version selected by a V2 test Learning Session.';
comment on column public.learning_sessions.section_measurement_snapshot_id is
  'Immutable section measurement snapshot selected by a V2 test Learning Session for reproducible reports.';
