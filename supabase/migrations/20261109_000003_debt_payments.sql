-- Historial inmutable de pagos de deudas y saldo pendiente sincronizado.
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists debt_payments_household_debt_date_idx
  on public.debt_payments(household_id, debt_id, occurred_on desc);

create or replace function public.validate_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_amount bigint;
  paid_so_far bigint;
begin
  select amount_cents into debt_amount
  from public.debts
  where id = new.debt_id and household_id = new.household_id;
  if debt_amount is null then
    raise exception 'debt and household do not match';
  end if;
  select coalesce(sum(amount_cents), 0) into paid_so_far
  from public.debt_payments
  where debt_id = new.debt_id and id is distinct from new.id;
  if paid_so_far + new.amount_cents > debt_amount then
    raise exception 'payment exceeds debt balance';
  end if;
  return new;
end;
$$;

create or replace function public.sync_debt_paid_cents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_debt_id uuid;
begin
  if tg_op = 'DELETE' then
    target_debt_id := old.debt_id;
  else
    target_debt_id := new.debt_id;
  end if;
  update public.debts
  set paid_cents = (
    select coalesce(sum(amount_cents), 0)
    from public.debt_payments
    where debt_id = target_debt_id
  )
  where id = target_debt_id;
  return null;
end;
$$;

drop trigger if exists debt_payments_validate on public.debt_payments;
create trigger debt_payments_validate
  before insert or update on public.debt_payments
  for each row execute function public.validate_debt_payment();

drop trigger if exists debt_payments_sync_debt on public.debt_payments;
create trigger debt_payments_sync_debt
  after insert or update or delete on public.debt_payments
  for each row execute function public.sync_debt_paid_cents();

alter table public.debt_payments enable row level security;

drop policy if exists "members read debt payments" on public.debt_payments;
drop policy if exists "members add own debt payments" on public.debt_payments;
create policy "members read debt payments"
  on public.debt_payments for select
  using (public.is_household_member(household_id));
create policy "members add own debt payments"
  on public.debt_payments for insert
  with check (public.is_household_member(household_id) and user_id = auth.uid());

grant select, insert on public.debt_payments to authenticated;
