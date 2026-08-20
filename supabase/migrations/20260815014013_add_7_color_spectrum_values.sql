-- Add the official 7-color measurement spectrum values.
-- Keep this separate from functions that reference the new enum values so Postgres
-- can commit enum additions before later migrations use them in expressions.

alter type public.result_color add value if not exists 'orange' after 'red';
alter type public.result_color add value if not exists 'blue' after 'green';
alter type public.result_color add value if not exists 'indigo' after 'blue';
