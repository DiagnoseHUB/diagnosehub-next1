-- Account-Löschung: freigegebene gemeinsame Drehmomentwerte bleiben erhalten.
-- Der einreichende Account wird bei Löschung anonymisiert statt den freigegebenen Wert zu entfernen.

do $$
begin
  if to_regclass('public.torque_specs') is null then
    return;
  end if;

  alter table public.torque_specs
    alter column user_id drop not null;

  alter table public.torque_specs
    drop constraint if exists torque_specs_user_id_fkey;

  alter table public.torque_specs
    add constraint torque_specs_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete set null;
end $$;
