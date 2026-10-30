import { useMemo, useState } from 'react';
import { Activity, Bot, Globe, MousePointerClick, Sparkles, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQuery } from '../../lib/useQuery';
import { rpc, type RecentVisit, type TrafficSummary } from '../../lib/memberRpc';
import { GlassCard } from '../../components/ui/shared';
import { Badge, EmptyState, PageHeader, Select, Spinner } from '../../components/ui/kit';

const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last year' },
];

const CLASS_LABEL: Record<string, string> = {
  human: 'People',
  automation: 'Automation (scripts, driven browsers)',
  ai_crawler: 'AI crawlers',
  search_crawler: 'Search crawlers',
};

const kindTone = (k: string) => (k === 'ai' ? 'blue' : k === 'search' ? 'green' : k === 'social' ? 'amber' : 'neutral') as 'blue' | 'green' | 'amber' | 'neutral';

function minutes(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string | number; hint?: string }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</div>
      {hint && <div className="mt-0.5 text-xs text-neutral-400">{hint}</div>}
    </GlassCard>
  );
}

function Bars({ rows, empty = 'Nothing yet' }: { rows: { label: string; n: number; tag?: React.ReactNode }[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="text-sm text-neutral-400">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-neutral-700">
              {r.label} {r.tag}
            </span>
            <span className="shrink-0 font-medium text-neutral-900">{r.n.toLocaleString('en-IN')}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-black/[0.06]">
            <div className="h-1.5 rounded-full bg-[#1a1a1a]" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <GlassCard className="p-5">
      <h3 className="font-medium text-neutral-900">{title}</h3>
      {hint && <p className="mb-3 text-xs text-neutral-500">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </GlassCard>
  );
}

export function AdminTraffic() {
  const [days, setDays] = useState(30);
  const range = useMemo(() => ({ from: new Date(Date.now() - days * 86400000).toISOString(), to: new Date().toISOString() }), [days]);

  const summary = useQuery(async () => {
    const { data, error } = await rpc<TrafficSummary>('analytics_summary', { p_from: range.from, p_to: range.to });
    if (error) throw new Error(error.message);
    return data as TrafficSummary;
  }, [range.from]);
  const recent = useQuery(async () => {
    const { data, error } = await rpc<RecentVisit[]>('analytics_recent', { p_limit: 40 });
    if (error) throw new Error(error.message);
    return (data ?? []) as RecentVisit[];
  }, [range.from]);

  if (!summary.data) return summary.error ? <EmptyState icon={<Activity size={22} />} title="Could not load traffic" description={summary.error} /> : <Spinner />;
  const s = summary.data;
  const bots = s.visits - s.humans;
  const place = (p: { country: string; region: string; city: string }) => [p.city, p.region, p.country].filter(Boolean).join(', ');

  return (
    <div>
      <PageHeader
        title="Website traffic"
        subtitle="Who visits egirerobotics.com, where from, and what they do. No cookies, no IP addresses stored."
        actions={
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>
                {r.label}
              </option>
            ))}
          </Select>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Users size={15} />} label="People (visits)" value={s.humans} hint={`${s.unique_visitors.toLocaleString('en-IN')} different people a day, added up`} />
        <Stat icon={<Activity size={15} />} label="Pages viewed" value={s.pageviews} hint={`about ${minutes(s.avg_seconds)} on the site`} />
        <Stat icon={<MousePointerClick size={15} />} label="Clicks" value={s.clicks} hint={`${s.signups} registered, ${s.signins} signed in`} />
        <Stat icon={<Bot size={15} />} label="Bots and scripts" value={bots} hint={`${s.humans + bots ? Math.round((bots / (s.humans + bots)) * 100) : 0}% of all visits`} />
      </div>

      <GlassCard className="mb-5 p-5">
        <h3 className="mb-3 font-medium text-neutral-900">Visits each day</h3>
        {s.by_day.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="human" name="People" stroke="#1a1a1a" fill="#1a1a1a" fillOpacity={0.15} />
                <Area type="monotone" dataKey="bots" name="Bots and scripts" stroke="#d97706" fill="#d97706" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={<Activity size={22} />} title="No visits recorded yet" description="Visits appear here as soon as people open the website with tracking switched on." />
        )}
      </GlassCard>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Section title="Where visitors come from" hint="Search, social, email, AI assistants and direct visits">
          <Bars rows={s.sources.map((x) => ({ label: x.name || (x.kind === 'direct' ? 'Direct' : x.kind), n: x.n, tag: <Badge tone={kindTone(x.kind)}>{x.kind}</Badge> }))} />
        </Section>
        <Section title="From AI assistants" hint="People who clicked a link inside ChatGPT, Perplexity, Gemini, Claude, Copilot and similar">
          <Bars rows={s.ai_sources.map((x) => ({ label: x.name, n: x.n }))} empty="No visits from AI assistants yet" />
          <p className="mt-3 flex items-start gap-2 text-xs text-neutral-500">
            <Sparkles size={14} className="mt-0.5 shrink-0" /> These are people. Crawlers that read the site for AI training are counted under bots below.
          </p>
        </Section>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Section title="Countries">
          <Bars rows={s.countries.map((x) => ({ label: x.country, n: x.n }))} empty="Location is recorded for new visits" />
        </Section>
        <Section title="Cities and regions" hint="City level appears when the visitor's location is available">
          <Bars rows={s.places.map((x) => ({ label: place(x), n: x.n }))} empty="No city-level locations yet" />
        </Section>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Section title="Top pages (where people arrive)">
          <Bars rows={s.top_pages.map((x) => ({ label: x.path, n: x.n }))} />
        </Section>
        <Section title="Devices">
          <Bars rows={s.devices.map((x) => ({ label: x.device, n: x.n }))} />
          <div className="mt-4">
            <Bars rows={s.browsers.map((x) => ({ label: x.browser, n: x.n }))} />
          </div>
        </Section>
        <Section title="Most clicked" hint="Buttons and links people press">
          <Bars rows={s.clicks_top.map((x) => ({ label: `${x.target}`, n: x.n, tag: <span className="text-xs text-neutral-400">{x.path}</span> }))} empty="No clicks recorded yet" />
        </Section>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Section title="Real people and automation" hint="A guess from the browser's own signals, never a proof">
          <Bars rows={Object.entries(s.by_class).map(([k, n]) => ({ label: CLASS_LABEL[k] ?? k, n }))} />
        </Section>
        <Section title="Bots and automated clicks seen" hint="Named when the visitor identifies itself">
          <Bars rows={s.bots.map((x) => ({ label: x.name || 'unnamed', n: x.n, tag: <Badge tone={x.class === 'automation' ? 'red' : 'amber'}>{CLASS_LABEL[x.class]?.split(' (')[0] ?? x.class}</Badge> }))} empty="No bots or scripts seen" />
        </Section>
      </div>

      <GlassCard className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-medium text-neutral-900">
          <Globe size={16} /> Latest visits
        </h3>
        {!recent.data ? (
          <Spinner />
        ) : !recent.data.length ? (
          <p className="text-sm text-neutral-400">No visits yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="py-2 pr-3">When</th>
                  <th className="pr-3">Page</th>
                  <th className="pr-3">From</th>
                  <th className="pr-3">Where</th>
                  <th className="pr-3">Device</th>
                  <th className="pr-3">Type</th>
                  <th className="pr-3">Pages</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.data.map((v, i) => (
                  <tr key={i} className="border-t border-black/5">
                    <td className="whitespace-nowrap py-2 pr-3 text-neutral-500">{new Date(v.started_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="max-w-[14rem] truncate pr-3 text-neutral-800">{v.entry_path}</td>
                    <td className="pr-3">{v.source_name || v.source_kind}</td>
                    <td className="pr-3">{[v.city, v.country].filter(Boolean).join(', ') || '—'}</td>
                    <td className="pr-3">{[v.device, v.browser].filter(Boolean).join(' · ')}</td>
                    <td className="pr-3">
                      <Badge tone={v.traffic_class === 'human' ? 'green' : v.traffic_class === 'automation' ? 'red' : 'amber'}>{v.traffic_class === 'human' ? (v.member ? 'member' : 'person') : v.bot_name || v.traffic_class}</Badge>
                    </td>
                    <td className="pr-3">{v.pages}</td>
                    <td>{minutes(v.duration_s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
