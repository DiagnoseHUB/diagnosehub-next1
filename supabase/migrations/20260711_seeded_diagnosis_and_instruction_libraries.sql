create table if not exists public.instruction_guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  source_query text not null default '',
  source_type text not null default 'manual',
  title text not null default '',
  subtitle text not null default '',
  category text not null default 'Diagnose',
  difficulty text not null default 'mittel',
  estimated_time text not null default 'Fahrzeugabhängig',
  vehicle_applicability text not null default '',
  tags text[] not null default '{}'::text[],
  diagnosis_goal text not null default '',
  missing_vehicle_data text[] not null default '{}'::text[],
  required_skill text not null default '',
  escalation_criteria text[] not null default '{}'::text[],
  symptoms text[] not null default '{}'::text[],
  tools text[] not null default '{}'::text[],
  parts_and_materials text[] not null default '{}'::text[],
  safety_notes text[] not null default '{}'::text[],
  initial_checks text[] not null default '{}'::text[],
  measurement_plan text[] not null default '{}'::text[],
  steps jsonb not null default '[]'::jsonb,
  common_causes text[] not null default '{}'::text[],
  next_actions text[] not null default '{}'::text[],
  final_checks text[] not null default '{}'::text[],
  pro_hint text,
  last_updated date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instruction_guides_category_check check (
    category in ('Motor', 'Elektrik', 'Klima', 'Fahrwerk', 'Bremse', 'Diagnose')
  ),
  constraint instruction_guides_difficulty_check check (
    difficulty in ('leicht', 'mittel', 'schwer')
  ),
  constraint instruction_guides_source_type_check check (
    source_type in ('ai', 'diagnosis', 'manual', 'seed')
  )
);

alter table public.instruction_guides
  add column if not exists diagnosis_goal text not null default '',
  add column if not exists missing_vehicle_data text[] not null default '{}'::text[],
  add column if not exists required_skill text not null default '',
  add column if not exists escalation_criteria text[] not null default '{}'::text[],
  add column if not exists parts_and_materials text[] not null default '{}'::text[],
  add column if not exists measurement_plan text[] not null default '{}'::text[],
  add column if not exists final_checks text[] not null default '{}'::text[];

create index if not exists instruction_guides_source_query_idx
  on public.instruction_guides(source_type, updated_at desc);

create index if not exists instruction_guides_category_idx
  on public.instruction_guides(category, updated_at desc);

create table if not exists public.diagnosis_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  source_query text not null default '',
  normalized_query text not null,
  audience_mode text not null default 'workshop',
  title text not null default '',
  category text not null default 'Diagnose',
  system_group text not null default '',
  fault_codes text[] not null default '{}'::text[],
  symptoms text[] not null default '{}'::text[],
  vehicle_terms text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  answer text not null default '',
  quality_note text not null default '',
  source text not null default 'seed',
  status text not null default 'approved',
  hit_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnosis_library_audience_mode_check check (
    audience_mode in ('workshop', 'hobby')
  ),
  constraint diagnosis_library_category_check check (
    category in ('Motor', 'Elektrik', 'Klima', 'Fahrwerk', 'Bremse', 'Diagnose')
  ),
  constraint diagnosis_library_source_check check (
    source in ('seed', 'manual', 'ai_generated')
  ),
  constraint diagnosis_library_status_check check (
    status in ('approved', 'needs_review', 'archived')
  ),
  constraint diagnosis_library_normalized_query_check check (
    length(trim(normalized_query)) >= 2
  )
);

create index if not exists diagnosis_library_mode_status_idx
  on public.diagnosis_library(audience_mode, status, updated_at desc);

create index if not exists diagnosis_library_fault_codes_idx
  on public.diagnosis_library using gin(fault_codes);

create index if not exists diagnosis_library_tags_idx
  on public.diagnosis_library using gin(tags);

create or replace function public.set_diagnosehub_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_instruction_guides_updated_at
  on public.instruction_guides;

create trigger set_instruction_guides_updated_at
before update on public.instruction_guides
for each row
execute function public.set_diagnosehub_updated_at();

drop trigger if exists set_diagnosis_library_updated_at
  on public.diagnosis_library;

create trigger set_diagnosis_library_updated_at
before update on public.diagnosis_library
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.instruction_guides enable row level security;
alter table public.diagnosis_library enable row level security;

drop policy if exists "Gespeicherte Anleitungen lesen"
  on public.instruction_guides;

create policy "Gespeicherte Anleitungen lesen"
on public.instruction_guides
for select
to authenticated
using (true);

drop policy if exists "Freigegebene Diagnosebibliothek lesen"
  on public.diagnosis_library;

create policy "Freigegebene Diagnosebibliothek lesen"
on public.diagnosis_library
for select
to authenticated
using (status = 'approved');
