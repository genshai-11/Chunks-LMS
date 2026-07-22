-- Live-test resources, prompt-language audio, and reproducible CPD metadata.
-- Additive: existing Learning Sessions default to lesson format and keep current live behavior.

create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  sha256 text,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.live_test_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  title text not null,
  version text not null default '1.0.0',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  source_filename text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, title, version)
);

create table if not exists public.live_test_blocks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.live_test_resources (id) on delete cascade,
  block_number integer not null check (block_number between 1 and 8),
  title text,
  cci_min numeric,
  cci_max numeric,
  cci_avg numeric,
  cvr_min numeric,
  cvr_max numeric,
  cvr_avg numeric,
  cpd_min numeric generated always as (cvr_min * cci_min) stored,
  cpd_max numeric generated always as (cvr_max * cci_max) stored,
  cpd_avg numeric generated always as (cvr_avg * cci_avg) stored,
  intro_text_vi text,
  intro_text_en text,
  intro_audio_vi_asset_id uuid references public.audio_assets (id),
  intro_audio_en_asset_id uuid references public.audio_assets (id),
  created_at timestamptz not null default now(),
  unique (resource_id, block_number)
);

create table if not exists public.live_test_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.live_test_blocks (id) on delete cascade,
  item_number integer not null check (item_number between 1 and 10),
  source_day text,
  source_stt text,
  unit_ohm numeric,
  cci_value numeric,
  cci_measure text not null default 'Unit (Ohm)',
  cci_unit_label text not null default 'CCI',
  cci_source text not null default 'csv:Unit (Ohm)',
  term_vi text not null,
  term_en text not null,
  prompt_vi text,
  prompt_en text,
  tc numeric,
  lc numeric,
  tl numeric,
  cvr_value numeric,
  cvr_measure text not null default 'Estimated TC × LC × TL',
  cvr_unit_label text not null default 'CVR',
  cvr_breakdown jsonb not null default '{}'::jsonb,
  cpd_value numeric generated always as (cvr_value * cci_value) stored,
  audio_vi_asset_id uuid references public.audio_assets (id),
  audio_en_asset_id uuid references public.audio_assets (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (block_id, item_number),
  check (cci_value is null or cci_value >= 0),
  check (cvr_value is null or cvr_value >= 0)
);

create index if not exists live_test_blocks_resource_idx
  on public.live_test_blocks (resource_id, block_number);

create index if not exists live_test_items_block_idx
  on public.live_test_items (block_id, item_number);

alter table public.learning_sessions
  add column if not exists session_format text not null default 'lesson'
    check (session_format in ('lesson', 'test')),
  add column if not exists prompt_language text null
    check (prompt_language in ('vi', 'en')),
  add column if not exists live_test_resource_id uuid null references public.live_test_resources (id),
  add column if not exists live_test_block_id uuid null references public.live_test_blocks (id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'learning_sessions_lesson_test_shape'
      and conrelid = 'public.learning_sessions'::regclass
  ) then
    alter table public.learning_sessions
      add constraint learning_sessions_lesson_test_shape check (
        (
          session_format = 'lesson'
          and prompt_language is null
          and live_test_resource_id is null
          and live_test_block_id is null
        )
        or
        (
          session_format = 'test'
          and prompt_language is not null
          and live_test_resource_id is not null
          and live_test_block_id is not null
        )
      );
  end if;
end $$;

alter table public.audio_assets enable row level security;
alter table public.live_test_resources enable row level security;
alter table public.live_test_blocks enable row level security;
alter table public.live_test_items enable row level security;

-- V1 demo posture: readable to app clients; import/upsert is allowed for authenticated/anon
-- local workflows. Tighten to service-role/RPC before multi-tenant production hardening.
create policy audio_assets_read on public.audio_assets
  for select to authenticated, anon using (true);
create policy audio_assets_write on public.audio_assets
  for all to authenticated, anon using (true) with check (true);

create policy live_test_resources_read on public.live_test_resources
  for select to authenticated, anon using (true);
create policy live_test_resources_write on public.live_test_resources
  for all to authenticated, anon using (true) with check (true);

create policy live_test_blocks_read on public.live_test_blocks
  for select to authenticated, anon using (true);
create policy live_test_blocks_write on public.live_test_blocks
  for all to authenticated, anon using (true) with check (true);

create policy live_test_items_read on public.live_test_items
  for select to authenticated, anon using (true);
create policy live_test_items_write on public.live_test_items
  for all to authenticated, anon using (true) with check (true);

comment on table public.live_test_resources is
  'Predefined live-test packages: 8 blocks x 10 items, prompt-language content, and CVR/CCI metadata.';
comment on table public.live_test_items is
  'Live-test prompts with source CVR and CCI measurements; CPD is derived as CVR x CCI.';
comment on column public.learning_sessions.session_format is
  'lesson = current live observation; test = resource-driven live-test input.';
comment on column public.learning_sessions.prompt_language is
  'For test sessions, selects Vietnamese or English complete sentence for display/audio.';
