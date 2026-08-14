-- Support 7-color probe outcomes (Yellow on fail, Indigo on done) and dynamic color values

alter type public.result_color add value if not exists 'orange';
alter type public.result_color add value if not exists 'blue';
alter type public.result_color add value if not exists 'indigo';

-- Function replacements that use the new enum values are intentionally in the next
-- migration so PostgreSQL commits enum additions before those values are referenced.
