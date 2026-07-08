do $$
begin
  if to_regclass('public.instruction_guides') is not null then
    alter table public.instruction_guides
      add column if not exists diagnosis_goal text not null default '',
      add column if not exists missing_vehicle_data text[] not null default '{}'::text[],
      add column if not exists required_skill text not null default '',
      add column if not exists escalation_criteria text[] not null default '{}'::text[],
      add column if not exists parts_and_materials text[] not null default '{}'::text[],
      add column if not exists measurement_plan text[] not null default '{}'::text[],
      add column if not exists final_checks text[] not null default '{}'::text[];
  end if;
end $$;
