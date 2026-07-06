create table if not exists public.workshop_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  workshop_name text not null default 'Nicht angegeben',
  email text not null default '',
  role text not null default 'Privatnutzer',
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnosis_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Unbenannter Diagnosefall',
  messages jsonb not null default '[]'::jsonb,
  engine_context jsonb,
  fault_code_context jsonb,
  quality_check text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnosis_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  diagnosis_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

create index if not exists diagnosis_cases_user_updated_idx
  on public.diagnosis_cases(user_id, updated_at desc);

create index if not exists diagnosis_usage_user_date_idx
  on public.diagnosis_usage(user_id, usage_date);

create or replace function public.set_diagnosehub_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_workshop_profiles_updated_at
  on public.workshop_profiles;

create trigger set_workshop_profiles_updated_at
before update on public.workshop_profiles
for each row
execute function public.set_diagnosehub_updated_at();

drop trigger if exists set_diagnosis_cases_updated_at
  on public.diagnosis_cases;

create trigger set_diagnosis_cases_updated_at
before update on public.diagnosis_cases
for each row
execute function public.set_diagnosehub_updated_at();

drop trigger if exists set_diagnosis_usage_updated_at
  on public.diagnosis_usage;

create trigger set_diagnosis_usage_updated_at
before update on public.diagnosis_usage
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.workshop_profiles enable row level security;
alter table public.diagnosis_cases enable row level security;
alter table public.diagnosis_usage enable row level security;

drop policy if exists "Eigenes Profil lesen"
  on public.workshop_profiles;
drop policy if exists "Eigenes Profil anlegen"
  on public.workshop_profiles;
drop policy if exists "Eigenes Profil aktualisieren"
  on public.workshop_profiles;
drop policy if exists "Eigenes Profil loeschen"
  on public.workshop_profiles;

create policy "Eigenes Profil lesen"
on public.workshop_profiles
for select
to authenticated
using (id = auth.uid());

create policy "Eigenes Profil anlegen"
on public.workshop_profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "Eigenes Profil aktualisieren"
on public.workshop_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Eigenes Profil loeschen"
on public.workshop_profiles
for delete
to authenticated
using (id = auth.uid());

drop policy if exists "Eigene Diagnosefaelle lesen"
  on public.diagnosis_cases;
drop policy if exists "Eigene Diagnosefaelle anlegen"
  on public.diagnosis_cases;
drop policy if exists "Eigene Diagnosefaelle aktualisieren"
  on public.diagnosis_cases;
drop policy if exists "Eigene Diagnosefaelle loeschen"
  on public.diagnosis_cases;

create policy "Eigene Diagnosefaelle lesen"
on public.diagnosis_cases
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene Diagnosefaelle anlegen"
on public.diagnosis_cases
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Eigene Diagnosefaelle aktualisieren"
on public.diagnosis_cases
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Eigene Diagnosefaelle loeschen"
on public.diagnosis_cases
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Eigene Diagnosenutzung lesen"
  on public.diagnosis_usage;
drop policy if exists "Eigene Diagnosenutzung anlegen"
  on public.diagnosis_usage;
drop policy if exists "Eigene Diagnosenutzung aktualisieren"
  on public.diagnosis_usage;
drop policy if exists "Eigene Diagnosenutzung loeschen"
  on public.diagnosis_usage;

create policy "Eigene Diagnosenutzung lesen"
on public.diagnosis_usage
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene Diagnosenutzung anlegen"
on public.diagnosis_usage
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Eigene Diagnosenutzung aktualisieren"
on public.diagnosis_usage
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Eigene Diagnosenutzung loeschen"
on public.diagnosis_usage
for delete
to authenticated
using (user_id = auth.uid());
