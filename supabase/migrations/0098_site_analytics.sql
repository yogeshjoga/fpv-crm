-- Website traffic analytics, written by the public website and read in the CRM.
--
-- Privacy by design: no IP address and no cookie is stored. A visitor is the SHA-256 of IP + browser + day + a salt that changes
-- every day, so the same person cannot be followed from one day to the next. Location is country, region and city from the request.
-- Rows older than 400 days are removed.
--
-- The website calls two anon-callable functions (track_visit, track_event). Both validate and size-limit everything, rate limit by a
-- hash of the network, and write only to these two tables, which have no client policies. The CRM reads through analytics_* functions
-- guarded by the 'site_analytics' module.
--
-- Traffic classes are heuristics, not proof: human, automation (a driven browser or a script), ai_crawler, search_crawler.

create table if not exists public.analytics_salt (
  day date primary key,
  salt text not null
);
alter table public.analytics_salt enable row level security;
comment on table public.analytics_salt is 'Service-role only. RLS enabled with no policies is intentional - never client-accessible.';

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  session_key text not null unique check (char_length(session_key) between 8 and 64),
  visitor_hash text not null,
  entry_path text not null default '/' check (char_length(entry_path) <= 300),
  referrer_host text not null default '' check (char_length(referrer_host) <= 120),
  source_kind text not null default 'direct' check (source_kind in ('direct', 'search', 'social', 'ai', 'email', 'other')),
  source_name text not null default '' check (char_length(source_name) <= 60),
  utm_source text not null default '' check (char_length(utm_source) <= 80),
  utm_medium text not null default '' check (char_length(utm_medium) <= 80),
  utm_campaign text not null default '' check (char_length(utm_campaign) <= 80),
  country text not null default '' check (char_length(country) <= 80),
  region text not null default '' check (char_length(region) <= 80),
  city text not null default '' check (char_length(city) <= 80),
  device text not null default 'desktop' check (device in ('desktop', 'mobile', 'tablet')),
  browser text not null default '' check (char_length(browser) <= 40),
  os text not null default '' check (char_length(os) <= 40),
  language text not null default '' check (char_length(language) <= 20),
  traffic_class text not null default 'human' check (traffic_class in ('human', 'automation', 'ai_crawler', 'search_crawler')),
  bot_name text not null default '' check (char_length(bot_name) <= 60),
  signals jsonb not null default '{}'::jsonb check (pg_column_size(signals) < 1000),
  pages integer not null default 1,
  clicks integer not null default 0,
  max_scroll integer not null default 0 check (max_scroll between 0 and 100),
  duration_s integer not null default 0,
  member_id uuid references public.profiles(id) on delete set null,
  geo_raw jsonb check (pg_column_size(geo_raw) < 1500)
);
create index if not exists site_visits_started_idx on public.site_visits (started_at desc);
create index if not exists site_visits_class_idx on public.site_visits (traffic_class, started_at desc);

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  visit_id uuid not null references public.site_visits(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('page', 'click', 'signin', 'signup', 'form')),
  path text not null default '' check (char_length(path) <= 300),
  target text not null default '' check (char_length(target) <= 80),
  label text not null default '' check (char_length(label) <= 80)
);
create index if not exists site_events_visit_idx on public.site_events (visit_id, at);
create index if not exists site_events_at_idx on public.site_events (at desc);

alter table public.site_visits enable row level security;
alter table public.site_events enable row level security;
-- no client policies: only the functions below (security definer) touch these tables
create policy site_visits_staff_read on public.site_visits for select using (public.has_module_access('site_analytics', 'read'));
create policy site_events_staff_read on public.site_events for select using (public.has_module_access('site_analytics', 'read'));

-- who can open the analytics: admins only, by default
insert into public.role_module_access (role, module_key, access_level) values
  ('admin', 'site_analytics', 'write'),
  ('coordinator', 'site_analytics', 'none'),
  ('instructor', 'site_analytics', 'none')
on conflict (role, module_key) do nothing;

-- ───────── helpers (not callable by clients) ─────────
create or replace function public.analytics_headers()
returns jsonb language sql stable set search_path = public as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
$$;
revoke all on function public.analytics_headers() from public, anon, authenticated;

create or replace function public.analytics_visitor_hash(p_ip text, p_ua text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_salt text;
begin
  select salt into v_salt from public.analytics_salt where day = current_date;
  if v_salt is null then
    insert into public.analytics_salt (day, salt) values (current_date, encode(gen_random_bytes(16), 'hex'))
      on conflict (day) do nothing;
    select salt into v_salt from public.analytics_salt where day = current_date;
    delete from public.analytics_salt where day < current_date - 2;
  end if;
  return encode(digest(coalesce(p_ip, '') || '|' || coalesce(p_ua, '') || '|' || current_date::text || '|' || v_salt, 'sha256'), 'hex');
end $$;
revoke all on function public.analytics_visitor_hash(text, text) from public, anon, authenticated;

-- where a visit came from. AI assistants are told apart by the referring site or by the utm_source they add to links.
create or replace function public.analytics_classify_source(p_host text, p_utm_source text, p_utm_medium text)
returns table (kind text, name text) language plpgsql immutable as $$
declare h text := lower(coalesce(p_host, '')); u text := lower(coalesce(p_utm_source, ''));
begin
  if h ~ '(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$' or u in ('chatgpt.com', 'chatgpt') then return query select 'ai', 'ChatGPT'; return; end if;
  if h ~ '(^|\.)perplexity\.ai$' or u in ('perplexity', 'perplexity.ai') then return query select 'ai', 'Perplexity'; return; end if;
  if h ~ '(^|\.)(gemini\.google\.com|bard\.google\.com)$' or u in ('gemini', 'gemini.google.com') then return query select 'ai', 'Gemini'; return; end if;
  if h ~ '(^|\.)(copilot\.microsoft\.com)$' or u in ('copilot', 'copilot.microsoft.com') then return query select 'ai', 'Copilot'; return; end if;
  if h ~ '(^|\.)claude\.ai$' or u in ('claude', 'claude.ai') then return query select 'ai', 'Claude'; return; end if;
  if h ~ '(^|\.)(you\.com|phind\.com|poe\.com|meta\.ai|grok\.com|x\.ai|deepseek\.com|chat\.deepseek\.com|kimi\.com|mistral\.ai|chat\.mistral\.ai)$' then return query select 'ai', h; return; end if;
  if lower(coalesce(p_utm_medium, '')) = 'email' then return query select 'email', coalesce(nullif(u, ''), 'email'); return; end if;
  if h = '' then return query select 'direct', ''; return; end if;
  if h ~ '(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave|startpage)\.' then return query select 'search', (regexp_match(h, '(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave|startpage)'))[1]; return; end if;
  if h ~ '(^|\.)(facebook|instagram|linkedin|twitter|t|x|youtube|youtu|whatsapp|wa|reddit|telegram|t)\.(com|co|me|be|net)$' then return query select 'social', h; return; end if;
  if h ~ '(^|\.)mail\.' then return query select 'email', h; return; end if;
  return query select 'other', h;
end $$;
revoke all on function public.analytics_classify_source(text, text, text) from public, anon, authenticated;

-- ───────── what the website calls ─────────
create or replace function public.track_visit(p jsonb)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  h jsonb := public.analytics_headers();
  v_ip text := coalesce(nullif(h ->> 'cf-connecting-ip', ''), split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1));
  v_ua text := left(coalesce(h ->> 'user-agent', ''), 400);
  v_ual text := lower(v_ua);
  v_session text := left(coalesce(p ->> 'session', ''), 64);
  v_path text := left(coalesce(p ->> 'path', '/'), 300);
  v_ref text := left(lower(coalesce(p ->> 'referrer_host', '')), 120);
  v_utm_s text := left(coalesce(p ->> 'utm_source', ''), 80);
  v_utm_m text := left(coalesce(p ->> 'utm_medium', ''), 80);
  v_utm_c text := left(coalesce(p ->> 'utm_campaign', ''), 80);
  v_kind text; v_name text;
  v_class text := 'human'; v_bot text := '';
  v_device text := 'desktop';
  v_browser text; v_os text;
  v_geo jsonb;
  v_id uuid;
begin
  if char_length(v_session) < 8 or v_path = '' or left(v_path, 1) <> '/' then return null; end if;
  if not public.rate_limit_hit('visit:' || encode(digest(coalesce(v_ip, 'x'), 'sha256'), 'hex'), 40, 600) then return null; end if;

  select kind, name into v_kind, v_name from public.analytics_classify_source(v_ref, v_utm_s, v_utm_m);

  if v_ual ~ 'gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|ccbot|bytespider|google-extended|amazonbot|meta-externalagent|cohere|youbot|diffbot|petalbot' then
    v_class := 'ai_crawler'; v_bot := coalesce((regexp_match(v_ual, '(gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|ccbot|bytespider|google-extended|amazonbot|meta-externalagent|cohere|youbot|diffbot|petalbot)'))[1], '');
  elsif v_ual ~ 'googlebot|bingbot|duckduckbot|yandexbot|baiduspider|slurp|applebot|sogou|semrushbot|ahrefsbot|mj12bot' then
    v_class := 'search_crawler'; v_bot := coalesce((regexp_match(v_ual, '(googlebot|bingbot|duckduckbot|yandexbot|baiduspider|slurp|applebot|sogou|semrushbot|ahrefsbot|mj12bot)'))[1], '');
  elsif v_ual ~ 'headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|python-requests|curl/|wget/|scrapy|go-http-client|httpclient|node-fetch|axios|libwww|java/' or v_ua = ''
        or coalesce((p -> 'signals' ->> 'webdriver')::boolean, false) then
    v_class := 'automation'; v_bot := coalesce((regexp_match(v_ual, '(headlesschrome|phantomjs|puppeteer|playwright|selenium|python-requests|curl|wget|scrapy|go-http-client|node-fetch|axios)'))[1], case when coalesce((p -> 'signals' ->> 'webdriver')::boolean, false) then 'webdriver' else '' end);
  end if;

  if v_ual ~ 'ipad|tablet' then v_device := 'tablet'; elsif v_ual ~ 'mobi|android|iphone' then v_device := 'mobile'; end if;
  v_browser := case when v_ual ~ 'edg/' then 'Edge' when v_ual ~ 'opr/|opera' then 'Opera' when v_ual ~ 'chrome|crios' then 'Chrome' when v_ual ~ 'firefox|fxios' then 'Firefox' when v_ual ~ 'safari' then 'Safari' else '' end;
  v_os := case when v_ual ~ 'android' then 'Android' when v_ual ~ 'iphone|ipad|ios' then 'iOS' when v_ual ~ 'windows' then 'Windows' when v_ual ~ 'mac os|macintosh' then 'macOS' when v_ual ~ 'linux|x11' then 'Linux' else '' end;

  -- the platform's location headers, and a copy of what arrived so we can see what is available
  select coalesce(jsonb_object_agg(key, left(value #>> '{}', 80)), '{}'::jsonb) into v_geo
    from jsonb_each(h) where key like 'cf-%' and key not in ('cf-connecting-ip', 'cf-ray', 'cf-visitor');

  insert into public.site_visits as sv (session_key, visitor_hash, entry_path, referrer_host, source_kind, source_name, utm_source, utm_medium, utm_campaign,
      country, region, city, device, browser, os, language, traffic_class, bot_name, signals, member_id, geo_raw)
  values (v_session, public.analytics_visitor_hash(v_ip, v_ua), v_path, v_ref, v_kind, left(v_name, 60), v_utm_s, v_utm_m, v_utm_c,
      left(coalesce(v_geo ->> 'cf-ipcountry', ''), 80), left(coalesce(v_geo ->> 'cf-region', v_geo ->> 'cf-region-code', ''), 80), left(coalesce(v_geo ->> 'cf-ipcity', ''), 80),
      v_device, v_browser, v_os, left(coalesce(p ->> 'language', ''), 20), v_class, v_bot,
      jsonb_build_object('webdriver', coalesce((p -> 'signals' ->> 'webdriver')::boolean, false), 'touch', coalesce((p -> 'signals' ->> 'touch')::boolean, false)),
      auth.uid(), v_geo)
  on conflict (session_key) do update set last_seen_at = now()
  returning sv.id into v_id;

  if random() < 0.02 then delete from public.site_visits where started_at < now() - interval '400 days'; end if;
  return v_id;
end $$;
revoke all on function public.track_visit(jsonb) from public;
grant execute on function public.track_visit(jsonb) to anon, authenticated;

create or replace function public.track_event(p jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  h jsonb := public.analytics_headers();
  v_ip text := coalesce(nullif(h ->> 'cf-connecting-ip', ''), split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1));
  v_visit uuid;
  v_kind text := coalesce(p ->> 'kind', '');
  v_scroll integer := least(100, greatest(0, coalesce((p ->> 'scroll')::integer, 0)));
begin
  begin v_visit := (p ->> 'visit')::uuid; exception when others then return; end;
  if v_visit is null then return; end if;
  if not public.rate_limit_hit('event:' || encode(digest(coalesce(v_ip, 'x'), 'sha256'), 'hex'), 300, 600) then return; end if;
  if not exists (select 1 from public.site_visits where id = v_visit and started_at > now() - interval '12 hours') then return; end if;

  if v_kind in ('page', 'click', 'signin', 'signup', 'form') then
    insert into public.site_events (visit_id, kind, path, target, label)
    values (v_visit, v_kind, left(coalesce(p ->> 'path', ''), 300), left(coalesce(p ->> 'target', ''), 80), left(coalesce(p ->> 'label', ''), 80));
  end if;

  update public.site_visits set
    last_seen_at = now(),
    duration_s = greatest(duration_s, extract(epoch from now() - started_at)::integer),
    pages = pages + (case when v_kind = 'page' then 1 else 0 end),
    clicks = clicks + (case when v_kind = 'click' then 1 else 0 end),
    max_scroll = greatest(max_scroll, v_scroll),
    member_id = coalesce(member_id, auth.uid()),
    signals = signals || jsonb_build_object(
      'pointer', coalesce((p ->> 'pointer')::boolean, (signals ->> 'pointer')::boolean, false),
      'keys', coalesce((p ->> 'keys')::boolean, (signals ->> 'keys')::boolean, false),
      'webdriver', coalesce((p ->> 'webdriver')::boolean, (signals ->> 'webdriver')::boolean, false)),
    -- a driven browser reports itself, and a person does not click dozens of times in a few seconds
    traffic_class = case
      when traffic_class = 'human' and (coalesce((p ->> 'webdriver')::boolean, false) or (clicks > 60 and extract(epoch from now() - started_at) < 20)) then 'automation'
      else traffic_class end,
    bot_name = case when traffic_class = 'human' and coalesce((p ->> 'webdriver')::boolean, false) then 'webdriver' else bot_name end
  where id = v_visit;
end $$;
revoke all on function public.track_event(jsonb) from public;
grant execute on function public.track_event(jsonb) to anon, authenticated;

-- ───────── what the CRM calls ─────────
create or replace function public.analytics_summary(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.has_module_access('site_analytics', 'read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'visits', (select count(*) from public.site_visits where started_at between p_from and p_to),
    'humans', (select count(*) from public.site_visits where started_at between p_from and p_to and traffic_class = 'human'),
    'unique_visitors', (select count(distinct visitor_hash) from public.site_visits where started_at between p_from and p_to and traffic_class = 'human'),
    'pageviews', (select coalesce(sum(pages), 0) from public.site_visits where started_at between p_from and p_to and traffic_class = 'human'),
    'clicks', (select coalesce(sum(clicks), 0) from public.site_visits where started_at between p_from and p_to and traffic_class = 'human'),
    'avg_seconds', (select coalesce(round(avg(duration_s)), 0) from public.site_visits where started_at between p_from and p_to and traffic_class = 'human' and duration_s > 0),
    'members_visits', (select count(*) from public.site_visits where started_at between p_from and p_to and member_id is not null),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'human', h, 'bots', b) order by d) from (
        select started_at::date d, count(*) filter (where traffic_class = 'human') h, count(*) filter (where traffic_class <> 'human') b
        from public.site_visits where started_at between p_from and p_to group by 1) t), '[]'::jsonb),
    'by_class', coalesce((select jsonb_object_agg(traffic_class, n) from (select traffic_class, count(*) n from public.site_visits where started_at between p_from and p_to group by 1) t), '{}'::jsonb),
    'top_pages', coalesce((select jsonb_agg(jsonb_build_object('path', entry_path, 'n', n) order by n desc) from (
        select entry_path, count(*) n from public.site_visits where started_at between p_from and p_to and traffic_class = 'human' group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('kind', source_kind, 'name', source_name, 'n', n) order by n desc) from (
        select source_kind, source_name, count(*) n from public.site_visits where started_at between p_from and p_to and traffic_class = 'human' group by 1, 2 order by 3 desc limit 25) t), '[]'::jsonb),
    'ai_sources', coalesce((select jsonb_agg(jsonb_build_object('name', source_name, 'n', n) order by n desc) from (
        select source_name, count(*) n from public.site_visits where started_at between p_from and p_to and source_kind = 'ai' group by 1 order by 2 desc) t), '[]'::jsonb),
    'bots', coalesce((select jsonb_agg(jsonb_build_object('class', traffic_class, 'name', bot_name, 'n', n) order by n desc) from (
        select traffic_class, bot_name, count(*) n from public.site_visits where started_at between p_from and p_to and traffic_class <> 'human' group by 1, 2 order by 3 desc limit 20) t), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('country', country, 'n', n) order by n desc) from (
        select country, count(*) n from public.site_visits where started_at between p_from and p_to and traffic_class = 'human' and country <> '' group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(jsonb_build_object('country', country, 'region', region, 'city', city, 'n', n) order by n desc) from (
        select country, region, city, count(*) n from public.site_visits where started_at between p_from and p_to and traffic_class = 'human' and (city <> '' or region <> '') group by 1, 2, 3 order by 4 desc limit 25) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('device', device, 'n', n) order by n desc) from (
        select device, count(*) n from public.site_visits where started_at between p_from and p_to and traffic_class = 'human' group by 1) t), '[]'::jsonb),
    'browsers', coalesce((select jsonb_agg(jsonb_build_object('browser', browser, 'n', n) order by n desc) from (
        select browser, count(*) n from public.site_visits where started_at between p_from and p_to and traffic_class = 'human' and browser <> '' group by 1 order by 2 desc limit 8) t), '[]'::jsonb),
    'clicks_top', coalesce((select jsonb_agg(jsonb_build_object('target', target, 'path', path, 'n', n) order by n desc) from (
        select e.target, e.path, count(*) n from public.site_events e join public.site_visits v on v.id = e.visit_id
         where e.kind = 'click' and e.at between p_from and p_to and v.traffic_class = 'human' and e.target <> '' group by 1, 2 order by 3 desc limit 20) t), '[]'::jsonb),
    'signups', (select count(*) from public.site_events where kind = 'signup' and at between p_from and p_to),
    'signins', (select count(*) from public.site_events where kind = 'signin' and at between p_from and p_to)
  ) into r;
  return r;
end $$;
revoke all on function public.analytics_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.analytics_summary(timestamptz, timestamptz) to authenticated;

create or replace function public.analytics_recent(p_limit integer default 50)
returns table (started_at timestamptz, entry_path text, source_kind text, source_name text, country text, region text, city text, device text, browser text,
               traffic_class text, bot_name text, pages integer, clicks integer, duration_s integer, member boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_module_access('site_analytics', 'read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select v.started_at, v.entry_path, v.source_kind, v.source_name, v.country, v.region, v.city, v.device, v.browser, v.traffic_class, v.bot_name,
         v.pages, v.clicks, v.duration_s, v.member_id is not null
  from public.site_visits v order by v.started_at desc limit least(greatest(p_limit, 1), 200);
end $$;
revoke all on function public.analytics_recent(integer) from public, anon;
grant execute on function public.analytics_recent(integer) to authenticated;
