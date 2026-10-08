-- A small fixed-window rate limiter for public endpoints (the registration form). Keys are hashed by the caller,
-- so no IP address or email is kept here. Only the service role (edge functions) can use it.

create table public.public_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.public_rate_limits enable row level security;
-- no policies on purpose: nothing but the service role can read or write it

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hits integer;
begin
  insert into public.public_rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
        hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into v_hits;
  -- tidy old rows now and then so the table stays small
  if random() < 0.02 then
    delete from public.public_rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end $$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
