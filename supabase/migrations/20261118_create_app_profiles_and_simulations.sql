create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clerk_user_id text unique,
  full_name text,
  email text,
  is_pro boolean not null default false,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);
create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  simulation_name text not null,
  card_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.simulations enable row level security;
revoke all on public.profiles, public.simulations from anon;
grant select, insert, update on public.profiles, public.simulations to authenticated;
drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists simulations_owner_all on public.simulations;
create policy simulations_owner_all on public.simulations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function public.set_simulation_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists simulations_updated_at on public.simulations;
create trigger simulations_updated_at before update on public.simulations for each row execute function public.set_simulation_updated_at();
create index if not exists simulations_user_updated_idx on public.simulations(user_id, updated_at desc);
