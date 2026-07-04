create table if not exists public.service_reminder_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  reminder_days_before integer[] not null default array[60, 30, 7, 0],
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists service_reminder_notification_settings_unsubscribe_token_idx
  on public.service_reminder_notification_settings(unsubscribe_token);

create table if not exists public.service_reminder_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.service_reminder_vehicles(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('hu', 'service', 'brake-fluid')),
  notice_key text not null,
  due_date date,
  due_mileage integer,
  recipient_email text not null,
  provider_message_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists service_reminder_notification_log_unique_notice_idx
  on public.service_reminder_notification_log(user_id, vehicle_id, reminder_type, notice_key);

create index if not exists service_reminder_notification_log_user_id_idx
  on public.service_reminder_notification_log(user_id);

create or replace function public.set_service_reminder_notification_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_service_reminder_notification_settings_updated_at
  on public.service_reminder_notification_settings;

create trigger set_service_reminder_notification_settings_updated_at
before update on public.service_reminder_notification_settings
for each row
execute function public.set_service_reminder_notification_settings_updated_at();

alter table public.service_reminder_notification_settings enable row level security;
alter table public.service_reminder_notification_log enable row level security;

drop policy if exists "Eigene Service-Mail-Einstellungen lesen"
  on public.service_reminder_notification_settings;
drop policy if exists "Eigene Service-Mail-Einstellungen anlegen"
  on public.service_reminder_notification_settings;
drop policy if exists "Eigene Service-Mail-Einstellungen aktualisieren"
  on public.service_reminder_notification_settings;
drop policy if exists "Eigene Service-Mail-Protokolle lesen"
  on public.service_reminder_notification_log;

create policy "Eigene Service-Mail-Einstellungen lesen"
on public.service_reminder_notification_settings
for select
to authenticated
using (user_id = auth.uid());

create policy "Eigene Service-Mail-Einstellungen anlegen"
on public.service_reminder_notification_settings
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Eigene Service-Mail-Einstellungen aktualisieren"
on public.service_reminder_notification_settings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Eigene Service-Mail-Protokolle lesen"
on public.service_reminder_notification_log
for select
to authenticated
using (user_id = auth.uid());
