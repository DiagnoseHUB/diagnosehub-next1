create or replace function public.set_diagnosehub_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.diagnosis_correction_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source_type text not null default 'diagnosis',
  issue_type text not null default 'technical_error',
  severity text not null default 'normal',
  title text not null default '',
  page text not null default '',
  case_context text not null default '',
  quoted_text text not null default '',
  suggested_correction text not null default '',
  match_keywords text[] not null default '{}'::text[],
  status text not null default 'pending',
  approved_rule text not null default '',
  review_notes text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnosis_correction_suggestions_source_check check (
    source_type in ('diagnosis', 'instruction', 'learning', 'general')
  ),
  constraint diagnosis_correction_suggestions_issue_check check (
    issue_type in (
      'technical_error',
      'safety_risk',
      'missing_spec',
      'unclear_wording',
      'manufacturer_data_needed',
      'wrong_priority'
    )
  ),
  constraint diagnosis_correction_suggestions_severity_check check (
    severity in ('normal', 'important', 'safety_critical')
  ),
  constraint diagnosis_correction_suggestions_status_check check (
    status in ('pending', 'approved', 'rejected', 'archived')
  )
);

create index if not exists diagnosis_correction_suggestions_status_idx
  on public.diagnosis_correction_suggestions(status, updated_at desc);

create index if not exists diagnosis_correction_suggestions_user_idx
  on public.diagnosis_correction_suggestions(user_id, created_at desc);

create index if not exists diagnosis_correction_suggestions_keywords_idx
  on public.diagnosis_correction_suggestions using gin(match_keywords);

drop trigger if exists set_diagnosis_correction_suggestions_updated_at
  on public.diagnosis_correction_suggestions;

create trigger set_diagnosis_correction_suggestions_updated_at
before update on public.diagnosis_correction_suggestions
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.diagnosis_correction_suggestions enable row level security;

drop policy if exists "Freigegebene Fachkorrekturen lesen"
  on public.diagnosis_correction_suggestions;
drop policy if exists "Eigene Fachkorrekturen lesen"
  on public.diagnosis_correction_suggestions;
drop policy if exists "Eigene Fachkorrekturen anlegen"
  on public.diagnosis_correction_suggestions;

create policy "Freigegebene Fachkorrekturen lesen"
on public.diagnosis_correction_suggestions
for select
to authenticated
using (status = 'approved');

create policy "Eigene Fachkorrekturen lesen"
on public.diagnosis_correction_suggestions
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene Fachkorrekturen anlegen"
on public.diagnosis_correction_suggestions
for insert
to authenticated
with check (user_id = auth.uid());

insert into public.diagnosis_correction_suggestions (
  source_type,
  issue_type,
  severity,
  title,
  case_context,
  quoted_text,
  suggested_correction,
  match_keywords,
  status,
  approved_rule,
  review_notes,
  reviewed_at
)
values (
  'instruction',
  'safety_risk',
  'safety_critical',
  'DSG- und Automatikgetriebeöl nicht heiß ablassen',
  'Getriebeölwechsel, DSG, Automatikgetriebe, DQ250, DQ381, DQ500 und vergleichbare Nasskupplungs-/Automatiksysteme.',
  'Getriebe warmfahren.',
  'Nicht pauschal zum Warmfahren auffordern. Öltemperatur nach Herstellerdaten mit Diagnosetester prüfen. Öl nicht im heißen Zustand ablassen. Bei DQ250-DSG-Getriebeölwechsel nach dem Durchschalten der Fahrstufen Öltemperatur für die Ölstandseinstellung auf 35-45 °C bringen und per Diagnosetester überwachen. Wenn kein sicherer Temperaturwert hinterlegt ist, Temperaturfenster als fehlende Herstellerangabe kennzeichnen.',
  array[
    'dsg',
    'dq250',
    'dq381',
    'dq500',
    'automatik',
    'getriebeöl',
    'ölwechsel',
    'öltemperatur',
    'warmfahren'
  ],
  'approved',
  'Bei DSG- oder Automatikgetriebeöl-Arbeiten niemals pauschal schreiben, dass das Getriebe warmgefahren und dann das Öl abgelassen werden soll. Stattdessen: Öltemperatur nach Herstellerdaten mit Diagnosetester prüfen, Öl nicht heiß ablassen, Verbrennungsgefahr nur bei realem Heißölrisiko nennen und fehlende Temperaturfenster klar als Herstellerdaten markieren. Bei DQ250-DSG-Getriebeölwechsel nach dem Durchschalten der Fahrstufen Öltemperatur für die Ölstandseinstellung auf 35-45 °C bringen und per Diagnosetester überwachen.',
  'Startregel aus fachlicher Korrektur: heißes Getriebeöl darf nicht als Standardablauf abgelassen werden.',
  now()
)
on conflict do nothing;
