create table if not exists public.simulator_scenario_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  name text not null check (char_length(name) between 1 and 120),
  saved_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists simulator_scenario_versions_owner_history_idx
  on public.simulator_scenario_versions (user_id, scenario_id, created_at desc);

alter table public.simulator_scenario_versions enable row level security;
revoke all on table public.simulator_scenario_versions from anon, public;
grant select, insert on table public.simulator_scenario_versions to authenticated;

drop policy if exists "Users can read their own simulator scenario versions" on public.simulator_scenario_versions;
create policy "Users can read their own simulator scenario versions"
on public.simulator_scenario_versions for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own simulator scenario versions" on public.simulator_scenario_versions;
create policy "Users can create their own simulator scenario versions"
on public.simulator_scenario_versions for insert to authenticated
with check ((select auth.uid()) = user_id);

revoke execute on function public.touch_simulator_scenario_updated_at() from public, anon, authenticated;
