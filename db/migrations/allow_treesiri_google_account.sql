-- Update an existing Before User Created hook to allow approved Gmail accounts.

create or replace function public.restrict_auth_to_convertcake(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  email_address text := lower(trim(event->'user'->>'email'));
  auth_provider text := lower(trim(coalesce(
    event->'user'->'app_metadata'->>'provider',
    ''
  )));
begin
  if auth_provider <> 'google' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Sign in with an approved Google account.'
      )
    );
  end if;

  if email_address is null
    or position('@' in email_address) <= 1
    or length(email_address) - length(replace(email_address, '@', '')) <> 1
    or (
      split_part(email_address, '@', 2) <> 'convertcake.com'
      and email_address not in (
        'treesiri.for.work@gmail.com',
        'nattametee.ck@gmail.com'
      )
    )
  then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Only approved Google accounts are allowed.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.restrict_auth_to_convertcake(jsonb) to supabase_auth_admin;
revoke execute on function public.restrict_auth_to_convertcake(jsonb) from authenticated, anon, public;
