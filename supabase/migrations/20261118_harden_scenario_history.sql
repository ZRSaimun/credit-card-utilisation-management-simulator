alter table public.simulator_scenarios
  add column if not exists updated_at timestamptz not null default now();

create index if not exists simulator_scenarios_user_saved_at_idx
  on public.simulator_scenarios (user_id, saved_at desc);

create or replace function public.touch_simulator_scenario_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists simulator_scenarios_touch_updated_at on public.simulator_scenarios;
create trigger simulator_scenarios_touch_updated_at
before update on public.simulator_scenarios
for each row execute function public.touch_simulator_scenario_updated_at();

revoke execute on function public.touch_simulator_scenario_updated_at() from public, anon, authenticated;
