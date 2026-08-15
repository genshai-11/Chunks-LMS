-- Move starts_on, ends_on, and schedule columns from courses to classes.
-- Course is a shared template; Class is the actual offering with a start date and schedule.

alter table public.classes
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists schedule jsonb;
comment on column public.classes.starts_on is 'Class start date';
comment on column public.classes.ends_on is 'Auto-calculated ending date based on start date and schedule';
comment on column public.classes.schedule is 'Auto-schedule config: { slots, weekdays, startTime, durationMinutes, sessionCount, timeZone }';
-- Copy existing schedules from courses to classes
update public.classes c
set starts_on = co.starts_on,
    ends_on = co.ends_on,
    schedule = co.schedule
from public.courses co
where c.course_id = co.id;
-- Drop schedule columns from courses
alter table public.courses
  drop column if exists starts_on,
  drop column if exists ends_on,
  drop column if exists schedule;
