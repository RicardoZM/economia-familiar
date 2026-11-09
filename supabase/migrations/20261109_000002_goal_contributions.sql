-- Historial inmutable de aportaciones a objetivos y saldo sincronizado.
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists goal_contributions_household_goal_date_idx
  on public.goal_contributions(household_id, goal_id, occurred_on desc);

create or replace function public.validate_goal_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.goals
    where id = new.goal_id and household_id = new.household_id
  ) then
    raise exception 'goal and household do not match';
  end if;
  return new;
end;
$$;

create or replace function public.sync_goal_saved_cents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_goal_id uuid;
begin
  if tg_op = 'DELETE' then
    target_goal_id := old.goal_id;
  else
    target_goal_id := new.goal_id;
  end if;
  update public.goals
  set saved_cents = (
    select coalesce(sum(amount_cents), 0)
    from public.goal_contributions
    where goal_id = target_goal_id
  )
  where id = target_goal_id;
  return null;
end;
$$;

drop trigger if exists goal_contributions_validate on public.goal_contributions;
create trigger goal_contributions_validate
  before insert or update on public.goal_contributions
  for each row execute function public.validate_goal_contribution();

drop trigger if exists goal_contributions_sync_goal on public.goal_contributions;
create trigger goal_contributions_sync_goal
  after insert or update or delete on public.goal_contributions
  for each row execute function public.sync_goal_saved_cents();

alter table public.goal_contributions enable row level security;

drop policy if exists "members read goal contributions" on public.goal_contributions;
drop policy if exists "members add own goal contributions" on public.goal_contributions;
create policy "members read goal contributions"
  on public.goal_contributions for select
  using (public.is_household_member(household_id));
create policy "members add own goal contributions"
  on public.goal_contributions for insert
  with check (public.is_household_member(household_id) and user_id = auth.uid());

grant select, insert on public.goal_contributions to authenticated;
