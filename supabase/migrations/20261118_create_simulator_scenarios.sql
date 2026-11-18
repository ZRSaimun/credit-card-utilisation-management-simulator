create table public.simulator_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  name text not null check (char_length(name) between 1 and 120),
  saved_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, scenario_id)
);

alter table public.simulator_scenarios enable row level security;

revoke all on table public.simulator_scenarios from anon, public;
grant select, insert, update, delete on table public.simulator_scenarios to authenticated;

create policy "Users can read their own simulator scenarios"
on public.simulator_scenarios for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own simulator scenarios"
on public.simulator_scenarios for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own simulator scenarios"
on public.simulator_scenarios for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own simulator scenarios"
on public.simulator_scenarios for delete to authenticated
using ((select auth.uid()) = user_id);
