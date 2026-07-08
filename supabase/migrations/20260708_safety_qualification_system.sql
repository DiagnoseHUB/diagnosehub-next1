alter table public.workshop_profiles
  add column if not exists account_type text not null default 'private',
  add column if not exists qualification_level text not null default 'none',
  add column if not exists company_name text not null default '',
  add column if not exists company_address text not null default '',
  add column if not exists company_phone text not null default '',
  add column if not exists company_website text not null default '',
  add column if not exists company_verified boolean not null default false,
  add column if not exists hv_qualification text not null default 'none',
  add column if not exists hv_certificate_url text not null default '',
  add column if not exists hv_training_provider text not null default '',
  add column if not exists hv_training_date date,
  add column if not exists hv_certificate_name text not null default '',
  add column if not exists hv_verified boolean not null default false,
  add column if not exists hv_verified_at timestamptz,
  add column if not exists terms_safety_accepted_at timestamptz,
  add column if not exists risk_access_level text not null default 'yellow';

alter table public.workshop_profiles
  drop constraint if exists workshop_profiles_account_type_check,
  add constraint workshop_profiles_account_type_check check (
    account_type in ('private', 'mechanic', 'workshop', 'admin')
  );

alter table public.workshop_profiles
  drop constraint if exists workshop_profiles_qualification_level_check,
  add constraint workshop_profiles_qualification_level_check check (
    qualification_level in ('none', 'self_declared', 'verified_workshop', 'hv_verified')
  );

alter table public.workshop_profiles
  drop constraint if exists workshop_profiles_hv_qualification_check,
  add constraint workshop_profiles_hv_qualification_check check (
    hv_qualification in ('none', 'hv1', 'hv2', 'hv3', 'other')
  );

alter table public.workshop_profiles
  drop constraint if exists workshop_profiles_risk_access_level_check,
  add constraint workshop_profiles_risk_access_level_check check (
    risk_access_level in ('green', 'yellow', 'orange', 'red', 'hv')
  );

create table if not exists public.safety_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null default '',
  query text not null default '',
  source text not null default '',
  risk_class text not null,
  access_decision text not null,
  account_type text not null default 'private',
  qualification_level text not null default 'none',
  hv_verified boolean not null default false,
  warning_type text not null default '',
  safety_warning text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint safety_access_logs_risk_class_check check (
    risk_class in ('green', 'yellow', 'orange', 'red', 'hv', 'black')
  ),
  constraint safety_access_logs_access_decision_check check (
    access_decision in ('allow', 'allow_with_warning', 'limited', 'block')
  )
);

create index if not exists safety_access_logs_user_created_idx
  on public.safety_access_logs(user_id, created_at desc);

create index if not exists safety_access_logs_risk_created_idx
  on public.safety_access_logs(risk_class, created_at desc);

create table if not exists public.hv_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hv_qualification text not null default 'none',
  training_provider text not null default '',
  training_date date,
  certificate_url text not null default '',
  certificate_name text not null default '',
  company_name text not null default '',
  safety_confirmation boolean not null default false,
  status text not null default 'pending',
  review_comment text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hv_access_requests_hv_qualification_check check (
    hv_qualification in ('none', 'hv1', 'hv2', 'hv3', 'other')
  ),
  constraint hv_access_requests_status_check check (
    status in ('pending', 'approved', 'rejected')
  )
);

create index if not exists hv_access_requests_user_created_idx
  on public.hv_access_requests(user_id, created_at desc);

create index if not exists hv_access_requests_status_created_idx
  on public.hv_access_requests(status, created_at desc);

drop trigger if exists set_hv_access_requests_updated_at
  on public.hv_access_requests;

create trigger set_hv_access_requests_updated_at
before update on public.hv_access_requests
for each row
execute function public.set_diagnosehub_updated_at();

alter table public.safety_access_logs enable row level security;
alter table public.hv_access_requests enable row level security;

drop policy if exists "Eigene Sicherheitslogs lesen"
  on public.safety_access_logs;
drop policy if exists "Eigene Sicherheitslogs anlegen"
  on public.safety_access_logs;

create policy "Eigene Sicherheitslogs lesen"
on public.safety_access_logs
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene Sicherheitslogs anlegen"
on public.safety_access_logs
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Eigene HV-Anträge lesen"
  on public.hv_access_requests;
drop policy if exists "Eigene HV-Anträge anlegen"
  on public.hv_access_requests;
drop policy if exists "Eigene HV-Anträge aktualisieren"
  on public.hv_access_requests;

create policy "Eigene HV-Anträge lesen"
on public.hv_access_requests
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene HV-Anträge anlegen"
on public.hv_access_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
);

create policy "Eigene HV-Anträge aktualisieren"
on public.hv_access_requests
for update
to authenticated
using (
  user_id = auth.uid()
  and status = 'pending'
)
with check (
  user_id = auth.uid()
  and status = 'pending'
);
