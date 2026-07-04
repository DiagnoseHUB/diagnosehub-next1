create table if not exists public.service_reminder_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  license_plate text not null default '',
  make_model text not null default '',
  first_registration date,
  current_mileage integer not null default 0,
  last_hu_date date,
  last_service_date date,
  last_service_mileage integer not null default 0,
  service_interval_months integer not null default 12,
  service_interval_km integer not null default 15000,
  brake_fluid_date date,
  brake_fluid_interval_months integer not null default 24,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_reminder_vehicles_user_id_idx
  on public.service_reminder_vehicles(user_id);

create or replace function public.set_service_reminder_vehicles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_service_reminder_vehicles_updated_at
  on public.service_reminder_vehicles;

create trigger set_service_reminder_vehicles_updated_at
before update on public.service_reminder_vehicles
for each row
execute function public.set_service_reminder_vehicles_updated_at();

alter table public.service_reminder_vehicles enable row level security;

drop policy if exists "Eigene Servicefahrzeuge lesen"
  on public.service_reminder_vehicles;
drop policy if exists "Eigene Servicefahrzeuge anlegen"
  on public.service_reminder_vehicles;
drop policy if exists "Eigene Servicefahrzeuge aktualisieren"
  on public.service_reminder_vehicles;
drop policy if exists "Eigene Servicefahrzeuge löschen"
  on public.service_reminder_vehicles;

create policy "Eigene Servicefahrzeuge lesen"
on public.service_reminder_vehicles
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene Servicefahrzeuge anlegen"
on public.service_reminder_vehicles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Eigene Servicefahrzeuge aktualisieren"
on public.service_reminder_vehicles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Eigene Servicefahrzeuge löschen"
on public.service_reminder_vehicles
for delete
to authenticated
using (user_id = auth.uid());
