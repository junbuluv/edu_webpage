-- Signup allowlist hook (role audit, 2026-10-07). Run after schema.sql.
-- Supabase Auth calls public.hook_before_user_created for every new user once
-- the hook is enabled in the dashboard; '{}' allows, an error object denies.
do $$
declare
  v jsonb;
  allowed text[] := array[
    'student@baruchmail.cuny.edu',
    '  Faculty@Baruch.CUNY.edu ',
    'someone@login.cuny.edu',
    'someone@gmail.com'
  ];
  denied text[] := array[
    'someone@yahoo.com',
    'someone@baruch.cuny.edu.evil.example',
    'someone@notbaruch.cuny.edu',
    'no-at-sign',
    ''
  ];
  e text;
begin
  foreach e in array allowed loop
    v := public.hook_before_user_created(
      jsonb_build_object('user', jsonb_build_object('email', e))
    );
    if v is distinct from '{}'::jsonb then
      raise exception 'allowed address % was rejected: %', e, v;
    end if;
  end loop;

  foreach e in array denied loop
    v := public.hook_before_user_created(
      jsonb_build_object('user', jsonb_build_object('email', e))
    );
    if (v->'error'->>'http_code')::int is distinct from 403
       or coalesce(v->'error'->>'message', '') = '' then
      raise exception 'address % was not rejected with a 403 and a message: %', e, v;
    end if;
  end loop;

  -- No email at all (a phone or anonymous signup) is denied too.
  v := public.hook_before_user_created('{"user": {"phone": "+15555550100"}}');
  if (v->'error'->>'http_code')::int is distinct from 403 then
    raise exception 'a signup without an email was not rejected: %', v;
  end if;

  -- Only Supabase Auth may call it; client roles never can.
  if has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute')
     or has_function_privilege('service_role', 'public.hook_before_user_created(jsonb)', 'execute') then
    raise exception 'a client role can execute hook_before_user_created';
  end if;
end $$;
