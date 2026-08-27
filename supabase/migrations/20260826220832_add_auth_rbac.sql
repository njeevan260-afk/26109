-- HerdVitals Supabase Auth + RBAC foundation.
-- requested_role is onboarding input only. Authorization always uses the
-- protected public.user_roles table and never raw_user_meta_data.

create schema if not exists private;

do $$
begin
    create type public.app_role as enum (
        'DAIRY_FARMER',
        'VETERINARIAN',
        'DAIRY_COOPERATIVE',
        'ANIMAL_HEALTH_AUTHORITY'
    );
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.account_status as enum (
        'PENDING',
        'ACTIVE',
        'SUSPENDED'
    );
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.app_permission as enum (
        'dashboard.read',
        'animals.read',
        'predictions.read',
        'alerts.read',
        'alerts.manage',
        'events.read',
        'events.report',
        'events.confirm',
        'clusters.read',
        'model.manage',
        'simulation.manage'
    );
exception
    when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text check (
        display_name is null or char_length(display_name) between 1 and 120
    ),
    organization_name text check (
        organization_name is null or char_length(organization_name) <= 200
    ),
    requested_role public.app_role,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role public.app_role not null,
    status public.account_status not null default 'PENDING',
    assigned_by uuid references auth.users(id) on delete set null,
    assigned_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        (status = 'ACTIVE' and assigned_at is not null)
        or status <> 'ACTIVE'
    )
);

create table if not exists public.role_permissions (
    role public.app_role not null,
    permission public.app_permission not null,
    primary key (role, permission)
);

create index if not exists user_roles_assigned_by_idx
    on public.user_roles (assigned_by)
    where assigned_by is not null;

insert into public.role_permissions (role, permission)
values
    ('DAIRY_FARMER', 'dashboard.read'),
    ('DAIRY_FARMER', 'animals.read'),
    ('DAIRY_FARMER', 'predictions.read'),
    ('DAIRY_FARMER', 'alerts.read'),
    ('DAIRY_FARMER', 'events.read'),
    ('DAIRY_FARMER', 'events.report'),

    ('VETERINARIAN', 'dashboard.read'),
    ('VETERINARIAN', 'animals.read'),
    ('VETERINARIAN', 'predictions.read'),
    ('VETERINARIAN', 'alerts.read'),
    ('VETERINARIAN', 'alerts.manage'),
    ('VETERINARIAN', 'events.read'),
    ('VETERINARIAN', 'events.report'),
    ('VETERINARIAN', 'events.confirm'),

    ('DAIRY_COOPERATIVE', 'dashboard.read'),
    ('DAIRY_COOPERATIVE', 'animals.read'),
    ('DAIRY_COOPERATIVE', 'predictions.read'),
    ('DAIRY_COOPERATIVE', 'alerts.read'),
    ('DAIRY_COOPERATIVE', 'events.read'),
    ('DAIRY_COOPERATIVE', 'clusters.read'),

    ('ANIMAL_HEALTH_AUTHORITY', 'dashboard.read'),
    ('ANIMAL_HEALTH_AUTHORITY', 'animals.read'),
    ('ANIMAL_HEALTH_AUTHORITY', 'predictions.read'),
    ('ANIMAL_HEALTH_AUTHORITY', 'alerts.read'),
    ('ANIMAL_HEALTH_AUTHORITY', 'alerts.manage'),
    ('ANIMAL_HEALTH_AUTHORITY', 'events.read'),
    ('ANIMAL_HEALTH_AUTHORITY', 'events.report'),
    ('ANIMAL_HEALTH_AUTHORITY', 'events.confirm'),
    ('ANIMAL_HEALTH_AUTHORITY', 'clusters.read'),
    ('ANIMAL_HEALTH_AUTHORITY', 'model.manage'),
    ('ANIMAL_HEALTH_AUTHORITY', 'simulation.manage')
on conflict (role, permission) do nothing;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested public.app_role;
begin
    begin
        requested := (new.raw_user_meta_data ->> 'requested_role')::public.app_role;
    exception
        when invalid_text_representation then requested := null;
    end;

    insert into public.profiles (
        id,
        display_name,
        organization_name,
        requested_role
    )
    values (
        new.id,
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''),
        requested
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure private.handle_new_auth_user();

insert into public.profiles (
    id,
    display_name,
    organization_name,
    requested_role
)
select
    users.id,
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(users.raw_user_meta_data ->> 'organization_name'), ''),
    case
        when users.raw_user_meta_data ->> 'requested_role' in (
            'DAIRY_FARMER',
            'VETERINARIAN',
            'DAIRY_COOPERATIVE',
            'ANIMAL_HEALTH_AUTHORITY'
        ) then (users.raw_user_meta_data ->> 'requested_role')::public.app_role
        else null
    end
from auth.users as users
on conflict (id) do nothing;

revoke all on schema private from public, anon, authenticated;
revoke execute on function private.handle_new_auth_user()
    from public, anon, authenticated, service_role;

-- Supabase Auth invokes this hook before issuing a token. Enable it in
-- Authentication > Hooks > Custom Access Token after applying the migration.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
    claims jsonb;
    assigned_role public.app_role;
    assigned_status public.account_status;
begin
    select role, status
    into assigned_role, assigned_status
    from public.user_roles
    where user_id = (event ->> 'user_id')::uuid;

    claims := event -> 'claims';
    claims := jsonb_set(
        claims,
        '{user_role}',
        coalesce(to_jsonb(assigned_role), 'null'::jsonb)
    );
    claims := jsonb_set(
        claims,
        '{account_status}',
        coalesce(to_jsonb(assigned_status), '"PENDING"'::jsonb)
    );
    return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb)
    to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb)
    from public, anon, authenticated, service_role;

create or replace function private.authorize(
    requested_permission public.app_permission
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select (select auth.uid()) is not null
       and exists (
            select 1
            from public.user_roles ur
            join public.role_permissions rp on rp.role = ur.role
            where ur.user_id = (select auth.uid())
              and ur.status = 'ACTIVE'
              and rp.permission = requested_permission
       );
$$;

revoke execute on function private.authorize(public.app_permission) from public;
grant usage on schema private to authenticated;
grant execute on function private.authorize(public.app_permission) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
    on public.profiles for select
    to authenticated
    using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
    on public.profiles for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
    on public.user_roles for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists auth_admin_read_user_roles on public.user_roles;
create policy auth_admin_read_user_roles
    on public.user_roles for select
    to supabase_auth_admin
    using (true);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.role_permissions from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, organization_name, requested_role)
    on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;
grant select on table public.user_roles to supabase_auth_admin;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.user_roles to service_role;
grant select, insert, update, delete on table public.role_permissions to service_role;

-- Operational data is exposed only through the permission-checked FastAPI
-- service. The browser publishable key is used for Auth, not direct table I/O.
alter table public.animals enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.predictions enable row level security;
alter table public.alerts enable row level security;

revoke all on table public.animals from anon, authenticated;
revoke all on table public.sensor_readings from anon, authenticated;
revoke all on table public.predictions from anon, authenticated;
revoke all on table public.alerts from anon, authenticated;

grant select, insert, update, delete on table public.animals to service_role;
grant select, insert, update, delete on table public.sensor_readings to service_role;
grant select, insert, update, delete on table public.predictions to service_role;
grant select, insert, update, delete on table public.alerts to service_role;

comment on table public.profiles is
    'User-owned onboarding profile. requested_role never grants authorization.';
comment on table public.user_roles is
    'Server-controlled authoritative role and account activation state.';
comment on function private.authorize(public.app_permission) is
    'Checks the active server-controlled role for the current authenticated user.';
