-- Repair hosted Supabase Auth staff users so GoTrue can authenticate them.
-- GoTrue expects the hosted zero UUID instance plus empty-string token fields;
-- NULL token fields caused 500s, while NULL instance_id made users invisible (400).
update auth.users
set
  instance_id = '00000000-0000-0000-0000-000000000000',
  encrypted_password = extensions.crypt(
    case
      when lower(email) = 'chunker@example.com' then 'chunker123'
      else 'admin123'
    end,
    extensions.gen_salt('bf')
  ),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  updated_at = now()
where lower(email) in ('le.ntmkh@gmail.com', 'admin@example.com', 'chunker@example.com');

update auth.identities i
set
  identity_data = jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  last_sign_in_at = coalesce(i.last_sign_in_at, now()),
  updated_at = now()
from auth.users u
where i.user_id = u.id
  and lower(u.email) in ('le.ntmkh@gmail.com', 'admin@example.com', 'chunker@example.com');
