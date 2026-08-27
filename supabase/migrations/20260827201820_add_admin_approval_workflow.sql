-- Admin approval workflow and live role-request queue.

alter table public.profiles
    add column if not exists email text;

update public.profiles as profiles
set email = lower(users.email)
from auth.users as users
where users.id = profiles.id
  and profiles.email is distinct from lower(users.email);

create index if not exists user_roles_pending_created_idx
    on public.user_roles (created_at desc)
    where status = 'PENDING';

insert into public.role_permissions (role, permission)
select 'ADMIN'::public.app_role, permission
from unnest(enum_range(null::public.app_permission)) as permission
on conflict (role, permission) do nothing;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested public.app_role;
    initial_status public.account_status;
begin
    begin
        requested := (new.raw_user_meta_data ->> 'requested_role')::public.app_role;
    exception
        when invalid_text_representation then requested := null;
    end;

    -- ADMIN is never self-service. It can only be assigned by a trusted
    -- bootstrap or an existing admin workflow.
    if requested = 'ADMIN'::public.app_role then
        requested := null;
    end if;

    insert into public.profiles (
        id,
        email,
        display_name,
        organization_name,
        requested_role
    )
    values (
        new.id,
        lower(new.email),
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''),
        requested
    )
    on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        organization_name = coalesce(public.profiles.organization_name, excluded.organization_name),
        requested_role = coalesce(public.profiles.requested_role, excluded.requested_role),
        updated_at = now();

    if requested is not null then
        initial_status := case
            when requested = 'DAIRY_FARMER'::public.app_role
                then 'ACTIVE'::public.account_status
            else 'PENDING'::public.account_status
        end;

        insert into public.user_roles (
            user_id,
            role,
            status,
            assigned_at
        )
        values (
            new.id,
            requested,
            initial_status,
            case when initial_status = 'ACTIVE' then now() else null end
        )
        on conflict (user_id) do nothing;
    end if;

    return new;
end;
$$;

-- Backfill role requests for accounts created before this workflow existed.
insert into public.user_roles (user_id, role, status, assigned_at)
select
    profiles.id,
    profiles.requested_role,
    case
        when profiles.requested_role = 'DAIRY_FARMER'::public.app_role
            then 'ACTIVE'::public.account_status
        else 'PENDING'::public.account_status
    end,
    case
        when profiles.requested_role = 'DAIRY_FARMER'::public.app_role
            then now()
        else null
    end
from public.profiles as profiles
where profiles.requested_role is not null
  and profiles.requested_role <> 'ADMIN'::public.app_role
on conflict (user_id) do nothing;

-- Farmers require email verification but not administrator approval.
update public.user_roles as roles
set status = 'ACTIVE'::public.account_status,
    assigned_at = coalesce(roles.assigned_at, now()),
    updated_at = now()
from public.profiles as profiles
where profiles.id = roles.user_id
  and profiles.requested_role = 'DAIRY_FARMER'::public.app_role
  and roles.role = 'DAIRY_FARMER'::public.app_role
  and roles.status = 'PENDING'::public.account_status;

drop policy if exists profiles_admin_select_all on public.profiles;
create policy profiles_admin_select_all
    on public.profiles for select
    to authenticated
    using ((select private.authorize('admin.manage'::public.app_permission)));

drop policy if exists user_roles_admin_select_all on public.user_roles;
create policy user_roles_admin_select_all
    on public.user_roles for select
    to authenticated
    using ((select private.authorize('admin.manage'::public.app_permission)));

-- Postgres Changes respects RLS, so only an active ADMIN receives the queue.
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'user_roles'
    ) then
        alter publication supabase_realtime add table public.user_roles;
    end if;
end
$$;

comment on column public.profiles.email is
    'Normalized Auth email copied by the trusted signup trigger for admin review.';
