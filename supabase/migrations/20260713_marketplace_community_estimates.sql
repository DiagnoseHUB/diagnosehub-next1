alter table public.workshop_profiles
  add column if not exists community_rank text not null default 'azubi',
  add column if not exists marketplace_seller_status text not null default 'not_requested',
  add column if not exists marketplace_terms_accepted_at timestamptz,
  add column if not exists marketplace_review_notes text not null default '';

alter table public.workshop_profiles
  drop constraint if exists workshop_profiles_community_rank_check,
  add constraint workshop_profiles_community_rank_check check (
    community_rank in ('azubi', 'geselle', 'meister')
  );

alter table public.workshop_profiles
  drop constraint if exists workshop_profiles_marketplace_seller_status_check,
  add constraint workshop_profiles_marketplace_seller_status_check check (
    marketplace_seller_status in (
      'not_requested',
      'pending',
      'verified_dealer',
      'verified_workshop',
      'suspended',
      'rejected'
    )
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

create table if not exists public.used_part_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.workshop_profiles(id) on delete set null,
  title text not null default '',
  category text not null default '',
  manufacturer text not null default '',
  part_number text not null default '',
  oe_numbers text[] not null default '{}'::text[],
  vehicle_fitment jsonb not null default '{}'::jsonb,
  condition_note text not null default '',
  inspection_summary text not null default '',
  price_cents integer,
  currency text not null default 'EUR',
  warranty_terms text not null default '',
  return_terms text not null default '',
  image_urls text[] not null default '{}'::text[],
  risk_level text not null default 'normal',
  status text not null default 'draft',
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint used_part_listings_price_check check (
    price_cents is null or price_cents >= 0
  ),
  constraint used_part_listings_risk_level_check check (
    risk_level in ('normal', 'important', 'safety_relevant', 'blocked')
  ),
  constraint used_part_listings_status_check check (
    status in ('draft', 'in_review', 'needs_changes', 'active', 'paused', 'sold', 'rejected', 'archived')
  )
);

create table if not exists public.used_part_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.used_part_listings(id) on delete set null,
  buyer_id uuid references auth.users(id) on delete set null,
  seller_id uuid references public.workshop_profiles(id) on delete set null,
  requested_part text not null default '',
  vehicle_data text not null default '',
  symptom_context text not null default '',
  message text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint used_part_inquiries_status_check check (
    status in ('new', 'seller_contacted', 'offered', 'declined', 'closed')
  )
);

create table if not exists public.estimate_image_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  vehicle_data text not null default '',
  damage_description text not null default '',
  labor_rate_cents integer,
  image_count integer not null default 0,
  ai_result jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_image_cases_status_check check (
    status in ('draft', 'estimated', 'needs_review', 'archived')
  ),
  constraint estimate_image_cases_labor_rate_check check (
    labor_rate_cents is null or labor_rate_cents >= 0
  )
);

create index if not exists community_questions_status_created_idx
  on public.community_questions(status, created_at desc);

create index if not exists community_answers_question_created_idx
  on public.community_answers(question_id, created_at asc);

create index if not exists community_reputation_user_created_idx
  on public.community_reputation_events(user_id, created_at desc);

create index if not exists used_part_listings_status_created_idx
  on public.used_part_listings(status, created_at desc);

create index if not exists used_part_listings_seller_updated_idx
  on public.used_part_listings(seller_id, updated_at desc);

create index if not exists used_part_inquiries_buyer_created_idx
  on public.used_part_inquiries(buyer_id, created_at desc);

create index if not exists used_part_inquiries_seller_created_idx
  on public.used_part_inquiries(seller_id, created_at desc);

create index if not exists estimate_image_cases_user_created_idx
  on public.estimate_image_cases(user_id, created_at desc);

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

drop trigger if exists set_used_part_listings_updated_at
  on public.used_part_listings;

create trigger set_used_part_listings_updated_at
before update on public.used_part_listings
for each row
execute function public.set_diagnosehub_updated_at();

drop trigger if exists set_used_part_inquiries_updated_at
  on public.used_part_inquiries;

create trigger set_used_part_inquiries_updated_at
before update on public.used_part_inquiries
for each row
execute function public.set_diagnosehub_updated_at();

drop trigger if exists set_estimate_image_cases_updated_at
  on public.estimate_image_cases;

create trigger set_estimate_image_cases_updated_at
before update on public.estimate_image_cases
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.community_questions enable row level security;
alter table public.community_answers enable row level security;
alter table public.community_reputation_events enable row level security;
alter table public.used_part_listings enable row level security;
alter table public.used_part_inquiries enable row level security;
alter table public.estimate_image_cases enable row level security;

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

drop policy if exists "Gebrauchtteile lesen"
  on public.used_part_listings;
drop policy if exists "Eigene Gebrauchtteile anlegen"
  on public.used_part_listings;
drop policy if exists "Eigene Gebrauchtteile aktualisieren"
  on public.used_part_listings;

create policy "Gebrauchtteile lesen"
on public.used_part_listings
for select
to authenticated
using (
  status = 'active'
  or seller_id = auth.uid()
);

create policy "Eigene Gebrauchtteile anlegen"
on public.used_part_listings
for insert
to authenticated
with check (seller_id = auth.uid());

create policy "Eigene Gebrauchtteile aktualisieren"
on public.used_part_listings
for update
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

drop policy if exists "Eigene Teileanfragen lesen"
  on public.used_part_inquiries;
drop policy if exists "Eigene Teileanfragen anlegen"
  on public.used_part_inquiries;
drop policy if exists "Eigene Teileanfragen aktualisieren"
  on public.used_part_inquiries;

create policy "Eigene Teileanfragen lesen"
on public.used_part_inquiries
for select
to authenticated
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
);

create policy "Eigene Teileanfragen anlegen"
on public.used_part_inquiries
for insert
to authenticated
with check (buyer_id = auth.uid());

create policy "Eigene Teileanfragen aktualisieren"
on public.used_part_inquiries
for update
to authenticated
using (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
)
with check (
  buyer_id = auth.uid()
  or seller_id = auth.uid()
);

drop policy if exists "Eigene Bildkalkulationen lesen"
  on public.estimate_image_cases;
drop policy if exists "Eigene Bildkalkulationen anlegen"
  on public.estimate_image_cases;
drop policy if exists "Eigene Bildkalkulationen aktualisieren"
  on public.estimate_image_cases;

create policy "Eigene Bildkalkulationen lesen"
on public.estimate_image_cases
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene Bildkalkulationen anlegen"
on public.estimate_image_cases
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Eigene Bildkalkulationen aktualisieren"
on public.estimate_image_cases
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
