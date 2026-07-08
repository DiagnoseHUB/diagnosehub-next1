comment on table public.torque_specs is
  'Gemeinsame DiagnoseHUB-Drehmoment-Datenbank. Entwürfe und Einreichungen bleiben kontoabhängig nachvollziehbar, freigegebene Werte werden global geteilt.';

comment on column public.torque_specs.user_id is
  'Konto, das den Wert eingereicht hat. Dient der Nachvollziehbarkeit, nicht als private Trennung freigegebener Werte.';

comment on column public.torque_specs.visibility is
  'private = Entwurf oder Einreichung, shared = manuell freigegebener Wert der gemeinsamen Datenbank.';

create index if not exists torque_specs_shared_lookup_idx
  on public.torque_specs (
    manufacturer,
    model,
    series,
    engine_code,
    transmission_code,
    system_group,
    component,
    fastener,
    position,
    updated_at desc
  )
  where status = 'approved' and visibility = 'shared';

drop policy if exists "Eigene Drehmomente lesen"
  on public.torque_specs;
drop policy if exists "Freigegebene Drehmomente lesen"
  on public.torque_specs;
drop policy if exists "Eigene Drehmomente anlegen"
  on public.torque_specs;
drop policy if exists "Eigene Drehmomente bearbeiten"
  on public.torque_specs;
drop policy if exists "Eigene Drehmomente löschen"
  on public.torque_specs;
drop policy if exists "Eigene Drehmoment-Einreichungen lesen"
  on public.torque_specs;
drop policy if exists "Gemeinsame freigegebene Drehmomente lesen"
  on public.torque_specs;
drop policy if exists "Eigene Drehmoment-Einreichungen anlegen"
  on public.torque_specs;
drop policy if exists "Eigene Drehmoment-Einreichungen bearbeiten"
  on public.torque_specs;
drop policy if exists "Eigene Drehmoment-Einreichungen löschen"
  on public.torque_specs;

create policy "Eigene Drehmoment-Einreichungen lesen"
on public.torque_specs
for select
to authenticated
using (user_id = auth.uid());

create policy "Gemeinsame freigegebene Drehmomente lesen"
on public.torque_specs
for select
to authenticated
using (status = 'approved' and visibility = 'shared');

create policy "Eigene Drehmoment-Einreichungen anlegen"
on public.torque_specs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status in ('draft', 'pending_review')
  and visibility = 'private'
);

create policy "Eigene Drehmoment-Einreichungen bearbeiten"
on public.torque_specs
for update
to authenticated
using (
  user_id = auth.uid()
  and status in ('draft', 'pending_review', 'rejected')
)
with check (
  user_id = auth.uid()
  and status in ('draft', 'pending_review', 'rejected')
  and visibility = 'private'
);

create policy "Eigene Drehmoment-Einreichungen löschen"
on public.torque_specs
for delete
to authenticated
using (
  user_id = auth.uid()
  and status <> 'approved'
);
