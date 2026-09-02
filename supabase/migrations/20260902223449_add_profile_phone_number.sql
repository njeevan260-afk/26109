-- Store a normalized SMS-capable contact number for each application profile.
-- Existing accounts remain nullable; new registrations require the number in
-- the application UI and the trusted auth trigger copies it from metadata.

alter table public.profiles
    add column if not exists phone_number text;

alter table public.profiles
    drop constraint if exists profiles_phone_number_format;

alter table public.profiles
    add constraint profiles_phone_number_format
    check (
        phone_number is null
        or phone_number ~ '^\+[1-9][0-9]{7,14}$'
    );

update public.profiles as profiles
set phone_number = users.raw_user_meta_data ->> 'phone_number'
from auth.users as users
where users.id = profiles.id
  and profiles.phone_number is null
  and users.raw_user_meta_data ->> 'phone_number' ~ '^\+[1-9][0-9]{7,14}$';

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested public.app_role;
    initial_status public.account_status;
    contact_phone text;
    affiliation_name text;
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

    contact_phone := nullif(trim(new.raw_user_meta_data ->> 'phone_number'), '');
    affiliation_name := nullif(trim(new.raw_user_meta_data ->> 'organization_name'), '');

    if requested is not null and (
        contact_phone is null
        or contact_phone !~ '^\+[1-9][0-9]{7,14}$'
    ) then
        raise exception using
            errcode = '23514',
            message = 'A valid E.164 phone number is required for registration.';
    end if;

    if requested = 'DAIRY_COOPERATIVE'::public.app_role
       and affiliation_name is null then
        raise exception using
            errcode = '23514',
            message = 'A milk federation is required for dairy cooperative registration.';
    end if;

    if requested = 'DAIRY_FARMER'::public.app_role then
        affiliation_name := null;
    end if;

    insert into public.profiles (
        id,
        email,
        display_name,
        phone_number,
        organization_name,
        requested_role
    )
    values (
        new.id,
        lower(new.email),
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        contact_phone,
        affiliation_name,
        requested
    )
    on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        phone_number = coalesce(public.profiles.phone_number, excluded.phone_number),
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

grant update (phone_number)
    on table public.profiles to authenticated;

comment on column public.profiles.phone_number is
    'E.164 contact number collected at registration for future SMS alerts.';
