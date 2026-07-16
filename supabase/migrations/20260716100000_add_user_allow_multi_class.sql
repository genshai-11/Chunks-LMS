-- Migration: Add allow_multi_class to public.users table
-- This allows Admin to specify which learners are permitted to be active in multiple classes concurrently.

alter table public.users
  add column if not exists allow_multi_class boolean not null default false;

comment on column public.users.allow_multi_class is
  'Admin-managed setting: if true, this learner is allowed to be enrolled in multiple active classes concurrently.';
