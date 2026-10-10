-- Migration: Harden Standalone Test Scoping by Class Ownership
-- Canonical PRD: docs/plans/PRD-V1-TEACHER-SCOPED-SYNC.md
-- Canonical Ontology: docs/architecture/ONTOLOGY.md
-- Ensures that non-admin teachers can only access standalone test assignments, runs,
-- and items for learners currently enrolled in active classes owned by that teacher.

-- 1. Ensure staff resolution functions deterministically resolve auth.uid()
create or replace function public.current_staff_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid;
  v_user_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return null;
  end if;

  select u.id into v_user_id
  from public.users u
  where u.auth_user_id = v_uid
    and u.account_status = 'active'
    and exists (
      select 1 from public.staff_roles sr
      where sr.user_id = u.id
        and sr.active = true
        and sr.role in ('admin', 'teacher')
    )
  limit 1;

  return v_user_id;
end;
$$;

create or replace function public.current_staff_has_role(p_role public.app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid;
  v_has boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return false;
  end if;

  select exists (
    select 1
    from public.staff_roles sr
    join public.users u on u.id = sr.user_id
    where u.auth_user_id = v_uid
      and u.account_status = 'active'
      and sr.active = true
      and (
        sr.role = p_role
        or (sr.role = 'admin' and p_role = 'teacher')
      )
  ) into v_has;

  return coalesce(v_has, false);
end;
$$;

create or replace function public.current_staff_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
  select public.current_staff_has_role('admin');
$$;

-- 2. Restrict standalone test access by class ownership
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
  select public.current_staff_is_admin()
    or (
      public.current_staff_has_role('teacher')
      and exists (
        select 1
        from public.classes cl
        join public.enrollments e on e.class_id = cl.id
        join public.courses c on c.id = cl.course_id
        where cl.teacher_user_id = public.current_staff_user_id()
          and cl.status = 'active'
          and e.learner_user_id = p_learner_user_id
          and e.status = 'active'
          and c.organization_id = p_organization_id
      )
    );
$$;

revoke execute on function private.staff_can_manage_standalone_test(uuid, uuid)
  from public, anon;
grant execute on function private.staff_can_manage_standalone_test(uuid, uuid)
  to authenticated, service_role;

comment on function private.staff_can_manage_standalone_test(uuid, uuid) is
  'Restricts standalone test access: Admin has school-wide visibility; Teachers only manage learners enrolled in their active classes.';
