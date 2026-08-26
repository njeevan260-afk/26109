-- HerdVitals scientific-core schema.
-- The React client does not access these tables directly. FastAPI uses the
-- backend-only service role, so anon/authenticated access remains revoked.

create extension if not exists pgcrypto;

create table if not exists public.mastitis_events (
    id uuid primary key default gen_random_uuid(),
    animal_id uuid not null references public.animals(id) on delete cascade,
    event_time timestamptz not null,
    status text not null default 'SUSPECTED'
        check (status in ('SUSPECTED', 'CONFIRMED', 'DISMISSED')),
    diagnosis_method text not null
        check (diagnosis_method in (
            'CLINICAL_EXAM',
            'CMT',
            'SCC',
            'CULTURE',
            'TREATMENT_RECORD',
            'OTHER'
        )),
    diagnosis_result text,
    cmt_result text,
    scc_value integer check (scc_value is null or scc_value >= 0),
    clinical_signs jsonb not null default '[]'::jsonb
        check (jsonb_typeof(clinical_signs) = 'array'),
    confirmed_by text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (animal_id, event_time, diagnosis_method)
);

create table if not exists public.devices (
    device_id text primary key,
    animal_id uuid references public.animals(id) on delete set null,
    status text not null default 'OFFLINE'
        check (status in ('ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE')),
    last_seen timestamptz,
    battery_percent numeric(5, 2)
        check (battery_percent is null or battery_percent between 0 and 100),
    signal_strength_dbm smallint
        check (signal_strength_dbm is null or signal_strength_dbm between -150 and 0),
    firmware_version text,
    metadata jsonb not null default '{}'::jsonb
        check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.model_versions (
    id uuid primary key default gen_random_uuid(),
    model_name text not null,
    version text not null,
    algorithm text not null,
    target_horizon_days smallint not null
        check (target_horizon_days in (7, 14)),
    feature_names jsonb not null default '[]'::jsonb
        check (jsonb_typeof(feature_names) = 'array'),
    training_source text not null,
    metrics jsonb not null default '{}'::jsonb
        check (jsonb_typeof(metrics) = 'object'),
    artifact_uri text,
    trained_at timestamptz not null,
    activated_at timestamptz,
    is_active boolean not null default false,
    clinically_validated boolean not null default false,
    notes text,
    created_at timestamptz not null default now(),
    unique (model_name, version, target_horizon_days)
);

alter table public.sensor_readings
    add column if not exists quality_flag text not null default 'UNCHECKED';

alter table public.sensor_readings
    add column if not exists ingestion_id uuid;

alter table public.predictions
    add column if not exists model_version_id uuid
        references public.model_versions(id) on delete set null;

alter table public.predictions
    add column if not exists prediction_status text not null default 'AVAILABLE';

alter table public.predictions
    add column if not exists data_source text;

alter table public.predictions
    add column if not exists explanation jsonb not null default '{}'::jsonb;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'sensor_readings_quality_flag_check'
          and conrelid = 'public.sensor_readings'::regclass
    ) then
        alter table public.sensor_readings
            add constraint sensor_readings_quality_flag_check
            check (quality_flag in ('VALID', 'SUSPECT', 'INVALID', 'UNCHECKED'));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'predictions_prediction_status_check'
          and conrelid = 'public.predictions'::regclass
    ) then
        alter table public.predictions
            add constraint predictions_prediction_status_check
            check (prediction_status in (
                'AVAILABLE',
                'INSUFFICIENT_DATA',
                'MODEL_UNAVAILABLE',
                'FAILED'
            ));
    end if;
end
$$;

create index if not exists mastitis_events_animal_time_idx
    on public.mastitis_events (animal_id, event_time desc);

create index if not exists mastitis_events_confirmed_time_idx
    on public.mastitis_events (event_time desc)
    where status = 'CONFIRMED';

create index if not exists devices_animal_idx
    on public.devices (animal_id)
    where animal_id is not null;

create unique index if not exists model_versions_one_active_idx
    on public.model_versions (model_name, target_horizon_days)
    where is_active;

create index if not exists predictions_model_version_idx
    on public.predictions (model_version_id)
    where model_version_id is not null;

create index if not exists sensor_readings_ingestion_idx
    on public.sensor_readings (ingestion_id)
    where ingestion_id is not null;

alter table public.mastitis_events enable row level security;
alter table public.devices enable row level security;
alter table public.model_versions enable row level security;

revoke all on table public.mastitis_events from anon, authenticated;
revoke all on table public.devices from anon, authenticated;
revoke all on table public.model_versions from anon, authenticated;

grant select, insert, update, delete on table public.mastitis_events to service_role;
grant select, insert, update, delete on table public.devices to service_role;
grant select, insert, update, delete on table public.model_versions to service_role;

comment on table public.mastitis_events is
    'Clinically or diagnostically observed udder-health events used to construct forecasting labels.';
comment on table public.model_versions is
    'Versioned model provenance and evaluation metadata; clinically_validated defaults to false.';
comment on column public.predictions.prediction_status is
    'Explicit availability state. Insufficient inputs must not be represented as a fabricated probability.';
