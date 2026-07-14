-- Synchronisiert Forum-Ränge auch dann, wenn ein Rollennachweis direkt im Supabase Table Editor freigegeben wird.

alter table public.workshop_profiles
  add column if not exists account_type text not null default 'private',
  add column if not exists qualification_level text not null default 'none',
  add column if not exists hv_verified boolean not null default false,
  add column if not exists risk_access_level text not null default 'yellow',
  add column if not exists community_rank text not null default 'azubi',
  add column if not exists marketplace_seller_status text not null default 'not_requested',
  add column if not exists marketplace_review_notes text not null default '';

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
  drop constraint if exists workshop_profiles_risk_access_level_check,
  add constraint workshop_profiles_risk_access_level_check check (
    risk_access_level in ('green', 'yellow', 'orange', 'red', 'hv')
  );

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

create or replace function public.diagnosehub_rank_weight(rank_value text)
returns integer
language sql
immutable
as $$
  select case rank_value
    when 'meister' then 3
    when 'geselle' then 2
    else 1
  end;
$$;

create or replace function public.apply_role_verification_rank()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
    update public.workshop_profiles
    set
      community_rank = new.requested_rank,
      role = case
        when role in ('admin', 'inhaber') then role
        when role = 'meister' and new.requested_rank = 'geselle' then role
        else new.requested_rank
      end,
      account_type = case
        when account_type = 'admin' then account_type
        when new.requested_rank = 'meister' then 'workshop'
        when account_type = 'workshop' then 'workshop'
        else 'mechanic'
      end,
      qualification_level = case
        when qualification_level = 'hv_verified' or hv_verified = true then 'hv_verified'
        else 'verified_workshop'
      end,
      risk_access_level = case
        when risk_access_level = 'hv' or hv_verified = true then 'hv'
        else 'red'
      end,
      marketplace_seller_status = case
        when marketplace_seller_status in ('suspended', 'rejected') then marketplace_seller_status
        when new.requested_rank = 'meister' then 'verified_workshop'
        else 'verified_dealer'
      end,
      marketplace_review_notes = case
        when new.requested_rank = 'meister' then 'Meisterbrief freigegeben und auf alle Profilfreigaben übertragen.'
        else 'Gesellenbrief freigegeben und auf alle Profilfreigaben übertragen.'
      end,
      updated_at = now()
    where id = new.user_id
      and public.diagnosehub_rank_weight(coalesce(community_rank, 'azubi'))
        <= public.diagnosehub_rank_weight(new.requested_rank);
  end if;

  return new;
end;
$$;

drop trigger if exists apply_role_verification_rank_after_change
  on public.role_verification_requests;

create trigger apply_role_verification_rank_after_change
after insert or update of status, requested_rank, user_id
on public.role_verification_requests
for each row
execute function public.apply_role_verification_rank();

with highest_approved_rank as (
  select
    user_id,
    case
      when max(public.diagnosehub_rank_weight(requested_rank)) >= 3 then 'meister'
      when max(public.diagnosehub_rank_weight(requested_rank)) >= 2 then 'geselle'
      else 'azubi'
    end as approved_rank
  from public.role_verification_requests
  where status = 'approved'
  group by user_id
)
update public.workshop_profiles profile
set
  community_rank = highest_approved_rank.approved_rank,
  role = case
    when profile.role in ('admin', 'inhaber') then profile.role
    when profile.role = 'meister' and highest_approved_rank.approved_rank = 'geselle' then profile.role
    else highest_approved_rank.approved_rank
  end,
  account_type = case
    when profile.account_type = 'admin' then profile.account_type
    when highest_approved_rank.approved_rank = 'meister' then 'workshop'
    when profile.account_type = 'workshop' then 'workshop'
    else 'mechanic'
  end,
  qualification_level = case
    when profile.qualification_level = 'hv_verified' or profile.hv_verified = true then 'hv_verified'
    else 'verified_workshop'
  end,
  risk_access_level = case
    when profile.risk_access_level = 'hv' or profile.hv_verified = true then 'hv'
    else 'red'
  end,
  marketplace_seller_status = case
    when profile.marketplace_seller_status in ('suspended', 'rejected') then profile.marketplace_seller_status
    when highest_approved_rank.approved_rank = 'meister' then 'verified_workshop'
    else 'verified_dealer'
  end,
  marketplace_review_notes = case
    when highest_approved_rank.approved_rank = 'meister' then 'Meisterbrief freigegeben und auf alle Profilfreigaben übertragen.'
    when highest_approved_rank.approved_rank = 'geselle' then 'Gesellenbrief freigegeben und auf alle Profilfreigaben übertragen.'
    else profile.marketplace_review_notes
  end,
  updated_at = now()
from highest_approved_rank
where profile.id = highest_approved_rank.user_id
  and public.diagnosehub_rank_weight(coalesce(profile.community_rank, 'azubi'))
    <= public.diagnosehub_rank_weight(highest_approved_rank.approved_rank);

notify pgrst, 'reload schema';
