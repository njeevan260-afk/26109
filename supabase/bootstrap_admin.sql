-- 1. First create this user in Supabase Dashboard:
--    Authentication > Users > Add user
--    Email: njeevan260@gmail.com
--    Set the password there and mark the email confirmed if appropriate.
-- 2. Apply both ADMIN migrations before running this file.
-- 3. Run this block in the Supabase SQL Editor.

do $$
declare
    admin_user_id uuid;
begin
    select id
    into admin_user_id
    from auth.users
    where lower(email) = 'njeevan260@gmail.com'
    limit 1;

    if admin_user_id is null then
        raise exception 'Create njeevan260@gmail.com in Authentication > Users first';
    end if;

    insert into public.profiles (id, email, display_name, organization_name)
    values (
        admin_user_id,
        'njeevan260@gmail.com',
        'Jeevan N',
        'HerdVitals Administration'
    )
    on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        organization_name = excluded.organization_name,
        updated_at = now();

    insert into public.user_roles (
        user_id,
        role,
        status,
        assigned_by,
        assigned_at
    )
    values (
        admin_user_id,
        'ADMIN'::public.app_role,
        'ACTIVE'::public.account_status,
        admin_user_id,
        now()
    )
    on conflict (user_id) do update
    set role = 'ADMIN'::public.app_role,
        status = 'ACTIVE'::public.account_status,
        assigned_by = admin_user_id,
        assigned_at = now(),
        updated_at = now();
end
$$;
