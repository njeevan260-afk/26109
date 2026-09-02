-- Store per-animal demo geotags so GIS clusters can be derived from the
-- animals themselves instead of assigning the herd to fixed barn points.
-- Coordinates remain nullable for existing animals and sensors without GPS.

alter table public.animals
    add column if not exists latitude double precision;

alter table public.animals
    add column if not exists longitude double precision;

comment on column public.animals.latitude is
    'Nullable latitude used to place an animal in GIS location clusters.';
comment on column public.animals.longitude is
    'Nullable longitude used to place an animal in GIS location clusters.';
