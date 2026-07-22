-- Reject new Supabase Auth users unless their email belongs to Convert Cake.
-- After applying this migration, enable this function as the
-- Authentication > Hooks > Before User Created hook in the Supabase dashboard.

create or replace function public.restrict_auth_to_convertcake(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  email_address text := lower(trim(event->'user'->>'email'));
begin
  if email_address is null
    or position('@' in email_address) <= 1
    or length(email_address) - length(replace(email_address, '@', '')) <> 1
    or split_part(email_address, '@', 2) <> 'convertcake.com'
  then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Only @convertcake.com email addresses are allowed.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.restrict_auth_to_convertcake(jsonb) to supabase_auth_admin;
revoke execute on function public.restrict_auth_to_convertcake(jsonb) from authenticated, anon, public;
