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

create index if not exists community_reputation_user_created_idx
  on public.community_reputation_events(user_id, created_at desc);

alter table public.community_reputation_events enable row level security;

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
