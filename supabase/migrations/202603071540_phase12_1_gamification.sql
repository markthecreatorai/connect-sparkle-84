-- FASE 12.1 - Gamificação

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  streak_days int not null default 1,
  reward_amount numeric(10,2) not null default 0.5,
  created_at timestamptz not null default now(),
  unique(user_id, checkin_date)
);

create table if not exists public.daily_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spin_date date not null default current_date,
  prize_amount numeric(10,2) not null default 0,
  prize_label text,
  created_at timestamptz not null default now(),
  unique(user_id, spin_date)
);

alter table public.daily_checkins enable row level security;
alter table public.daily_spins enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='daily_checkins' and policyname='Users can view own checkins'
  ) then
    create policy "Users can view own checkins" on public.daily_checkins for select using (auth.uid()=user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='daily_spins' and policyname='Users can view own spins'
  ) then
    create policy "Users can view own spins" on public.daily_spins for select using (auth.uid()=user_id);
  end if;
end $$;
