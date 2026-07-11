-- Organization operational settings (metric display + probe defaults).
-- Client metric catalog UI persists here when Supabase is configured.

create table if not exists public.org_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  default_max_probe_count integer not null default 2 check (default_max_probe_count >= 1),
  metric_settings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.org_settings enable row level security;

-- Staff (any org member) can read; writes open for authenticated in V1 demo.
-- Tighten when membership product lands.
create policy org_settings_select on public.org_settings
  for select to authenticated, anon
  using (true);

create policy org_settings_upsert on public.org_settings
  for all to authenticated, anon
  using (true)
  with check (true);

comment on table public.org_settings is
  'Per-org metric UI settings and default max probe count (Phase C).';
