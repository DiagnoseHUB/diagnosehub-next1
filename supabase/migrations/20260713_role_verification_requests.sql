create or replace function public.set_diagnosehub_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

insert into storage.buckets (id, name, public)
values ('role-verifications', 'role-verifications', false)
on conflict (id) do nothing;

alter table public.workshop_profiles
  add column if not exists community_rank text not null default 'azubi';

alter table public.workshop_profiles
  drop constraint if exists workshop_profiles_community_rank_check,
  add constraint workshop_profiles_community_rank_check check (
    community_rank in ('azubi', 'geselle', 'meister')
  );

create table if not exists public.role_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_rank text not null,
  required_document text not null,
  document_path text not null default '',
  document_name text not null default '',
  document_mime_type text not null default '',
  document_size_bytes integer not null default 0,
  applicant_note text not null default '',
  status text not null default 'pending',
  review_notes text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_verification_requests_requested_rank_check check (
    requested_rank in ('geselle', 'meister')
  ),
  constraint role_verification_requests_required_document_check check (
    required_document in ('gesellenbrief', 'meisterbrief')
  ),
  constraint role_verification_requests_status_check check (
    status in ('pending', 'approved', 'rejected', 'cancelled')
  ),
  constraint role_verification_requests_document_size_check check (
    document_size_bytes >= 0
  )
);

create index if not exists role_verification_requests_user_created_idx
  on public.role_verification_requests(user_id, created_at desc);

create index if not exists role_verification_requests_status_created_idx
  on public.role_verification_requests(status, created_at desc);

drop trigger if exists set_role_verification_requests_updated_at
  on public.role_verification_requests;

create trigger set_role_verification_requests_updated_at
before update on public.role_verification_requests
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.role_verification_requests enable row level security;

drop policy if exists "Eigene Rollennachweise lesen"
  on public.role_verification_requests;
drop policy if exists "Eigene Rollennachweise anlegen"
  on public.role_verification_requests;
drop policy if exists "Eigene offene Rollennachweise aktualisieren"
  on public.role_verification_requests;

create policy "Eigene Rollennachweise lesen"
on public.role_verification_requests
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene Rollennachweise anlegen"
on public.role_verification_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
);

create policy "Eigene offene Rollennachweise aktualisieren"
on public.role_verification_requests
for update
to authenticated
using (
  user_id = auth.uid()
  and status = 'pending'
)
with check (
  user_id = auth.uid()
  and status in ('pending', 'cancelled')
);
