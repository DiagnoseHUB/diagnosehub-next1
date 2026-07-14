create or replace function public.set_diagnosehub_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.diagnosis_cases
  add column if not exists workspace jsonb not null default '{}'::jsonb,
  add column if not exists customer_report text not null default '',
  add column if not exists solved_summary text not null default '',
  add column if not exists solved_at timestamptz,
  add column if not exists knowledge_status text not null default 'none';

alter table public.diagnosis_cases
  drop constraint if exists diagnosis_cases_knowledge_status_check,
  add constraint diagnosis_cases_knowledge_status_check check (
    knowledge_status in ('none', 'draft', 'saved', 'archived')
  );

insert into storage.buckets (id, name, public)
values ('diagnosis-media', 'diagnosis-media', false)
on conflict (id) do nothing;

create table if not exists public.diagnosis_media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid,
  file_name text not null default '',
  media_type text not null default 'image',
  mime_type text not null default '',
  file_size_bytes integer not null default 0,
  storage_path text not null default '',
  analysis jsonb not null default '{}'::jsonb,
  analysis_text text not null default '',
  status text not null default 'analyzed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnosis_media_assets_media_type_check check (
    media_type in ('image', 'video')
  ),
  constraint diagnosis_media_assets_status_check check (
    status in ('uploaded', 'analyzed', 'needs_review', 'failed')
  ),
  constraint diagnosis_media_assets_file_size_check check (
    file_size_bytes >= 0
  )
);

create index if not exists diagnosis_media_assets_user_created_idx
  on public.diagnosis_media_assets(user_id, created_at desc);

create index if not exists diagnosis_media_assets_case_idx
  on public.diagnosis_media_assets(case_id, created_at desc);

drop trigger if exists set_diagnosis_media_assets_updated_at
  on public.diagnosis_media_assets;

create trigger set_diagnosis_media_assets_updated_at
before update on public.diagnosis_media_assets
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.diagnosis_media_assets enable row level security;

drop policy if exists "Eigene Diagnosemedien lesen"
  on public.diagnosis_media_assets;
drop policy if exists "Eigene Diagnosemedien anlegen"
  on public.diagnosis_media_assets;
drop policy if exists "Eigene Diagnosemedien aktualisieren"
  on public.diagnosis_media_assets;
drop policy if exists "Eigene Diagnosemedien löschen"
  on public.diagnosis_media_assets;

create policy "Eigene Diagnosemedien lesen"
on public.diagnosis_media_assets
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene Diagnosemedien anlegen"
on public.diagnosis_media_assets
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Eigene Diagnosemedien aktualisieren"
on public.diagnosis_media_assets
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Eigene Diagnosemedien löschen"
on public.diagnosis_media_assets
for delete
to authenticated
using (user_id = auth.uid());

create table if not exists public.diagnosis_case_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid,
  title text not null default '',
  vehicle_data text not null default '',
  fault_codes text[] not null default '{}'::text[],
  symptoms text[] not null default '{}'::text[],
  measurements jsonb not null default '[]'::jsonb,
  media_findings jsonb not null default '[]'::jsonb,
  solution_summary text not null default '',
  repair_result text not null default '',
  parts_used text not null default '',
  customer_safe_summary text not null default '',
  internal_notes text not null default '',
  status text not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnosis_case_knowledge_status_check check (
    status in ('internal', 'shared_review', 'archived')
  )
);

create index if not exists diagnosis_case_knowledge_user_created_idx
  on public.diagnosis_case_knowledge(user_id, created_at desc);

create index if not exists diagnosis_case_knowledge_case_idx
  on public.diagnosis_case_knowledge(case_id, created_at desc);

drop trigger if exists set_diagnosis_case_knowledge_updated_at
  on public.diagnosis_case_knowledge;

create trigger set_diagnosis_case_knowledge_updated_at
before update on public.diagnosis_case_knowledge
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.diagnosis_case_knowledge enable row level security;

drop policy if exists "Eigenes Werkstattwissen lesen"
  on public.diagnosis_case_knowledge;
drop policy if exists "Eigenes Werkstattwissen anlegen"
  on public.diagnosis_case_knowledge;
drop policy if exists "Eigenes Werkstattwissen aktualisieren"
  on public.diagnosis_case_knowledge;
drop policy if exists "Eigenes Werkstattwissen löschen"
  on public.diagnosis_case_knowledge;

create policy "Eigenes Werkstattwissen lesen"
on public.diagnosis_case_knowledge
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigenes Werkstattwissen anlegen"
on public.diagnosis_case_knowledge
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Eigenes Werkstattwissen aktualisieren"
on public.diagnosis_case_knowledge
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Eigenes Werkstattwissen löschen"
on public.diagnosis_case_knowledge
for delete
to authenticated
using (user_id = auth.uid());
