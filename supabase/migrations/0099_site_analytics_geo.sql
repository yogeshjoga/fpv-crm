-- Follow-up to 0098, applied to the live project in two steps. The versions below are what is running:
--  * track_visit takes region and city from the website's own location lookup (/api/geo, from Vercel's headers) when the request
--    itself carries only the country, and tolerates a badly typed "signals" value instead of failing the request.
--  * track_event ignores a badly typed flag instead of failing the request.
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
  v_country text; v_region text; v_city text;
  v_wd boolean := false;
  v_id uuid;
begin
  if char_length(v_session) < 8 or v_path = '' or left(v_path, 1) <> '/' then return null; end if;
  if not public.rate_limit_hit('visit:' || encode(digest(coalesce(v_ip, 'x'), 'sha256'), 'hex'), 40, 600) then return null; end if;
  begin v_wd := coalesce((p -> 'signals' ->> 'webdriver')::boolean, false); exception when others then v_wd := false; end;

  select c.kind, c.name into v_kind, v_name from public.analytics_classify_source(v_ref, v_utm_s, v_utm_m) c;

  if v_ual ~ 'gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|ccbot|bytespider|google-extended|amazonbot|meta-externalagent|cohere|youbot|diffbot|petalbot' then
    v_class := 'ai_crawler'; v_bot := coalesce((regexp_match(v_ual, '(gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|ccbot|bytespider|google-extended|amazonbot|meta-externalagent|cohere|youbot|diffbot|petalbot)'))[1], '');
  elsif v_ual ~ 'googlebot|bingbot|duckduckbot|yandexbot|baiduspider|slurp|applebot|sogou|semrushbot|ahrefsbot|mj12bot' then
    v_class := 'search_crawler'; v_bot := coalesce((regexp_match(v_ual, '(googlebot|bingbot|duckduckbot|yandexbot|baiduspider|slurp|applebot|sogou|semrushbot|ahrefsbot|mj12bot)'))[1], '');
  elsif v_ual ~ 'headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|python-requests|curl/|wget/|scrapy|go-http-client|httpclient|node-fetch|axios|libwww|java/' or v_ua = '' or v_wd then
    v_class := 'automation'; v_bot := coalesce((regexp_match(v_ual, '(headlesschrome|phantomjs|puppeteer|playwright|selenium|python-requests|curl|wget|scrapy|go-http-client|node-fetch|axios)'))[1], case when v_wd then 'webdriver' else '' end);
  end if;

  if v_ual ~ 'ipad|tablet' then v_device := 'tablet'; elsif v_ual ~ 'mobi|android|iphone' then v_device := 'mobile'; end if;
  v_browser := case when v_ual ~ 'edg/' then 'Edge' when v_ual ~ 'opr/|opera' then 'Opera' when v_ual ~ 'chrome|crios' then 'Chrome' when v_ual ~ 'firefox|fxios' then 'Firefox' when v_ual ~ 'safari' then 'Safari' else '' end;
  v_os := case when v_ual ~ 'android' then 'Android' when v_ual ~ 'iphone|ipad|ios' then 'iOS' when v_ual ~ 'windows' then 'Windows' when v_ual ~ 'mac os|macintosh' then 'macOS' when v_ual ~ 'linux|x11' then 'Linux' else '' end;

  select coalesce(jsonb_object_agg(key, left(value #>> '{}', 80)), '{}'::jsonb) into v_geo
    from jsonb_each(h) where key like 'cf-%' and key not in ('cf-connecting-ip', 'cf-ray', 'cf-visitor');

  v_country := left(coalesce(nullif(v_geo ->> 'cf-ipcountry', ''), p -> 'geo' ->> 'country', ''), 80);
  v_region := left(coalesce(nullif(v_geo ->> 'cf-region', ''), p -> 'geo' ->> 'region', ''), 80);
  v_city := left(coalesce(nullif(v_geo ->> 'cf-ipcity', ''), p -> 'geo' ->> 'city', ''), 80);

  insert into public.site_visits as sv (session_key, visitor_hash, entry_path, referrer_host, source_kind, source_name, utm_source, utm_medium, utm_campaign,
      country, region, city, device, browser, os, language, traffic_class, bot_name, signals, member_id, geo_raw)
  values (v_session, public.analytics_visitor_hash(v_ip, v_ua), v_path, v_ref, v_kind, left(v_name, 60), v_utm_s, v_utm_m, v_utm_c,
      v_country, v_region, v_city,
      v_device, v_browser, v_os, left(coalesce(p ->> 'language', ''), 20), v_class, v_bot,
      jsonb_build_object('webdriver', v_wd), auth.uid(), v_geo)
  on conflict (session_key) do update set last_seen_at = now()
  returning sv.id into v_id;

  if random() < 0.02 then delete from public.site_visits where started_at < now() - interval '400 days'; end if;
  return v_id;
end $$;
revoke all on function public.track_visit(jsonb) from public;
grant execute on function public.track_visit(jsonb) to anon, authenticated;
-- (track_event as in 0098, with each flag read inside begin ... exception when others then ... end; the live function does this.)
