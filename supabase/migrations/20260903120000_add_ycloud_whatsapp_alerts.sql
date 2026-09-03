-- Opt-in WhatsApp risk alerts and a durable, race-safe 24-hour send ledger.

alter table public.profiles
    add column if not exists whatsapp_alerts_enabled boolean not null default false;

create table if not exists public.whatsapp_alert_deliveries (
    id uuid primary key default gen_random_uuid(),
    animal_id uuid not null references public.animals(id) on delete cascade,
    recipient_user_id uuid references auth.users(id) on delete set null,
    recipient_phone text not null
        check (recipient_phone ~ '^\+[1-9][0-9]{7,14}$'),
    risk_category text not null check (risk_category in ('HIGH', 'MODERATE')),
    status text not null default 'PENDING'
        check (status in (
            'PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED',
            'REQUEST_FAILED'
        )),
    external_id text not null unique,
    ycloud_message_id text,
    error_message text,
    attempted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists whatsapp_alert_delivery_window_idx
    on public.whatsapp_alert_deliveries (animal_id, recipient_phone, attempted_at desc)
    where status <> 'REQUEST_FAILED';

create index if not exists whatsapp_alert_ycloud_message_idx
    on public.whatsapp_alert_deliveries (ycloud_message_id)
    where ycloud_message_id is not null;

create or replace function public.claim_whatsapp_risk_alert(
    p_animal_id uuid,
    p_recipient_user_id uuid,
    p_recipient_phone text,
    p_risk_category text,
    p_external_id text
)
returns setof public.whatsapp_alert_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
    claimed public.whatsapp_alert_deliveries%rowtype;
begin
    -- Serialize claims for the same cow and number to prevent simultaneous
    -- sensor requests from both passing the 24-hour check.
    perform pg_advisory_xact_lock(
        hashtextextended(p_animal_id::text || ':' || p_recipient_phone, 0)
    );

    if exists (
        select 1
        from public.whatsapp_alert_deliveries
        where animal_id = p_animal_id
          and recipient_phone = p_recipient_phone
          and (
              (status in ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED')
               and attempted_at > now() - interval '24 hours')
              or
              (status = 'PENDING'
               and attempted_at > now() - interval '15 minutes')
          )
    ) then
        return;
    end if;

    insert into public.whatsapp_alert_deliveries (
        animal_id,
        recipient_user_id,
        recipient_phone,
        risk_category,
        external_id
    )
    values (
        p_animal_id,
        p_recipient_user_id,
        p_recipient_phone,
        upper(p_risk_category),
        p_external_id
    )
    returning * into claimed;

    return next claimed;
end;
$$;

alter table public.whatsapp_alert_deliveries enable row level security;

revoke all on table public.whatsapp_alert_deliveries from anon, authenticated;
grant select, insert, update, delete
    on table public.whatsapp_alert_deliveries to service_role;

revoke execute on function public.claim_whatsapp_risk_alert(uuid, uuid, text, text, text)
    from public, anon, authenticated;
grant execute on function public.claim_whatsapp_risk_alert(uuid, uuid, text, text, text)
    to service_role;

grant update (whatsapp_alerts_enabled)
    on table public.profiles to authenticated;

comment on column public.profiles.whatsapp_alerts_enabled is
    'User consent flag for daily HIGH/MODERATE cow-risk WhatsApp notifications.';
comment on table public.whatsapp_alert_deliveries is
    'YCloud WhatsApp attempt/status ledger and rolling 24-hour deduplication source.';
