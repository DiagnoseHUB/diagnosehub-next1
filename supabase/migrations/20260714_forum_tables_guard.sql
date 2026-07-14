create or replace function public.set_diagnosehub_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.workshop_profiles
  add column if not exists community_rank text not null default 'azubi';

alter table public.workshop_profiles
  drop constraint if exists workshop_profiles_community_rank_check,
  add constraint workshop_profiles_community_rank_check check (
    community_rank in ('azubi', 'geselle', 'meister')
  );

create table if not exists public.community_questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null default '',
  body text not null default '',
  vehicle_data text not null default '',
  tags text[] not null default '{}'::text[],
  status text not null default 'open',
  accepted_answer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_questions_status_check check (
    status in ('open', 'answered', 'solved', 'archived')
  )
);

create table if not exists public.community_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.community_questions(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null default '',
  answer_rank text not null default 'geselle',
  is_accepted boolean not null default false,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_answers_answer_rank_check check (
    answer_rank in ('geselle', 'meister')
  )
);

alter table public.community_questions
  drop constraint if exists community_questions_accepted_answer_id_fkey,
  add constraint community_questions_accepted_answer_id_fkey
  foreign key (accepted_answer_id)
  references public.community_answers(id)
  on delete set null;

create table if not exists public.community_reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source_type text not null default 'question',
  source_id uuid,
  points integer not null default 0,
  reason text not null default '',
  created_at timestamptz not null default now(),
  constraint community_reputation_events_source_type_check check (
    source_type in ('question', 'answer', 'accepted_answer', 'marketplace_listing', 'estimate_case')
  )
);

create index if not exists community_questions_status_created_idx
  on public.community_questions(status, created_at desc);

create index if not exists community_answers_question_created_idx
  on public.community_answers(question_id, created_at asc);

create index if not exists community_reputation_user_created_idx
  on public.community_reputation_events(user_id, created_at desc);

drop trigger if exists set_community_questions_updated_at
  on public.community_questions;

create trigger set_community_questions_updated_at
before update on public.community_questions
for each row
execute function public.set_diagnosehub_updated_at();

drop trigger if exists set_community_answers_updated_at
  on public.community_answers;

create trigger set_community_answers_updated_at
before update on public.community_answers
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.community_questions enable row level security;
alter table public.community_answers enable row level security;
alter table public.community_reputation_events enable row level security;

drop policy if exists "Community Fragen lesen"
  on public.community_questions;
drop policy if exists "Community Fragen anlegen"
  on public.community_questions;
drop policy if exists "Eigene Community Fragen aktualisieren"
  on public.community_questions;

create policy "Community Fragen lesen"
on public.community_questions
for select
to authenticated
using (true);

create policy "Community Fragen anlegen"
on public.community_questions
for insert
to authenticated
with check (author_id = auth.uid());

create policy "Eigene Community Fragen aktualisieren"
on public.community_questions
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "Community Antworten lesen"
  on public.community_answers;
drop policy if exists "Community Antworten anlegen"
  on public.community_answers;
drop policy if exists "Eigene Community Antworten aktualisieren"
  on public.community_answers;

create policy "Community Antworten lesen"
on public.community_answers
for select
to authenticated
using (true);

create policy "Community Antworten anlegen"
on public.community_answers
for insert
to authenticated
with check (author_id = auth.uid());

create policy "Eigene Community Antworten aktualisieren"
on public.community_answers
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "Community Punkte lesen"
  on public.community_reputation_events;
drop policy if exists "Eigene Community Punkte anlegen"
  on public.community_reputation_events;

create policy "Community Punkte lesen"
on public.community_reputation_events
for select
to authenticated
using (true);

create policy "Eigene Community Punkte anlegen"
on public.community_reputation_events
for insert
to authenticated
with check (user_id = auth.uid());

notify pgrst, 'reload schema';
