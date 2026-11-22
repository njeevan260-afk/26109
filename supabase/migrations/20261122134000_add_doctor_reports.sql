-- HerdVitals Doctor Reports schema and RLS policies.
-- Enables dairy farmers to report cows to active verified veterinarians,
-- and enables veterinarians to access assigned consultation reports.

-- 1. Add locality to profiles for veterinarian service area/clinic locality.
alter table public.profiles
    add column if not exists locality text check (
        locality is null or char_length(locality) <= 120
    );

grant update (locality)
    on table public.profiles to authenticated;

comment on column public.profiles.locality is
    'Optional clinic locality or geographical service area for veterinarians.';

-- 2. Helper function to verify active veterinarian role status safely.
create or replace function public.is_active_veterinarian(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.user_roles
        where user_id = target_user_id
          and role = 'VETERINARIAN'::public.app_role
          and status = 'ACTIVE'::public.account_status
    );
$$;

revoke all on function public.is_active_veterinarian(uuid) from public;
grant execute on function public.is_active_veterinarian(uuid) to authenticated, service_role;

-- 3. Allow authenticated users to view active verified veterinarians in directory.
drop policy if exists profiles_select_active_veterinarians on public.profiles;
create policy profiles_select_active_veterinarians
    on public.profiles for select
    to authenticated
    using (public.is_active_veterinarian(id));

-- 4. View exposing only non-private directory details of active veterinarians.
create or replace view public.active_veterinarians as
select
    p.id,
    p.display_name,
    p.organization_name,
    p.locality,
    p.created_at
from public.profiles p
where public.is_active_veterinarian(p.id);

grant select on public.active_veterinarians to authenticated, service_role;

-- 5. Doctor reports table
create table if not exists public.doctor_reports (
    id uuid primary key default gen_random_uuid(),
    farmer_id uuid not null references auth.users(id) on delete cascade,
    cow_id uuid not null references public.animals(id) on delete cascade,
    veterinarian_id uuid not null references auth.users(id) on delete cascade,
    description text not null check (
        char_length(trim(description)) >= 5 and char_length(description) <= 2000
    ),
    status text not null default 'submitted' check (
        status in ('submitted', 'pending_review', 'under_investigation', 'resolved', 'closed')
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists doctor_reports_farmer_idx
    on public.doctor_reports (farmer_id, created_at desc);

create index if not exists doctor_reports_veterinarian_idx
    on public.doctor_reports (veterinarian_id, created_at desc);

create index if not exists doctor_reports_cow_idx
    on public.doctor_reports (cow_id, created_at desc);

-- 6. Least-privilege RLS on doctor_reports
alter table public.doctor_reports enable row level security;

revoke all on table public.doctor_reports from anon, authenticated;
grant select, insert on table public.doctor_reports to authenticated;
grant update (status, updated_at) on table public.doctor_reports to authenticated;
grant select, insert, update, delete on table public.doctor_reports to service_role;

-- Farmers can create reports only as themselves, and only targeting active verified veterinarians
drop policy if exists doctor_reports_insert_farmer on public.doctor_reports;
create policy doctor_reports_insert_farmer
    on public.doctor_reports for insert
    to authenticated
    with check (
        (select auth.uid()) = farmer_id
        and public.is_active_veterinarian(veterinarian_id)
    );

-- Farmers can read only their own reports
drop policy if exists doctor_reports_select_farmer on public.doctor_reports;
create policy doctor_reports_select_farmer
    on public.doctor_reports for select
    to authenticated
    using ((select auth.uid()) = farmer_id);

-- Veterinarians can read only reports assigned to them
drop policy if exists doctor_reports_select_veterinarian on public.doctor_reports;
create policy doctor_reports_select_veterinarian
    on public.doctor_reports for select
    to authenticated
    using (
        (select auth.uid()) = veterinarian_id
        and public.is_active_veterinarian((select auth.uid()))
    );

-- Veterinarians can update status on reports assigned to them
drop policy if exists doctor_reports_update_veterinarian on public.doctor_reports;
create policy doctor_reports_update_veterinarian
    on public.doctor_reports for update
    to authenticated
    using (
        (select auth.uid()) = veterinarian_id
        and public.is_active_veterinarian((select auth.uid()))
    )
    with check (
        (select auth.uid()) = veterinarian_id
        and public.is_active_veterinarian((select auth.uid()))
    );

-- Authorized admins can read all reports
drop policy if exists doctor_reports_select_admin on public.doctor_reports;
create policy doctor_reports_select_admin
    on public.doctor_reports for select
    to authenticated
    using ((select private.authorize('admin.manage'::public.app_permission)));

-- 7. Trigger to maintain updated_at
create or replace function private.set_doctor_reports_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists on_doctor_reports_updated on public.doctor_reports;
create trigger on_doctor_reports_updated
    before update on public.doctor_reports
    for each row execute procedure private.set_doctor_reports_updated_at();

-- 8. Enable Realtime updates for doctor_reports table
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'doctor_reports'
    ) then
        alter publication supabase_realtime add table public.doctor_reports;
    end if;
end
$$;

comment on table public.doctor_reports is
    'Clinical consultation reports submitted by farmers to active verified veterinarians.';
