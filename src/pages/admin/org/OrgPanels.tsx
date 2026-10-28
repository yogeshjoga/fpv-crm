import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeCheck, IndianRupee, Pencil, Percent, Target, Trophy, X } from 'lucide-react';
import { GlassCard } from '../../../components/ui/shared';
import { Button } from '../../../components/ui/kit';
import {
  ACCENTS, displayName, hasEnded, inr0, initials, metricsFor, pct, photoOf, profileIdOf, sourceLabel, subtreeIds, weeklySeries,
  type KpiSummary, type Metrics, type OrgNodeView,
} from '../../../lib/orgChart';

export function Avatar({ node, size = 44 }: { node: OrgNodeView; size?: number }) {
  const src = photoOf(node);
  const name = displayName(node);
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ width: size, height: size }} className="shrink-0 rounded-full border border-white object-cover shadow-sm" />
  ) : (
    <span style={{ width: size, height: size, fontSize: size * 0.36 }} className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${ACCENTS[node.accent].chip}`}>{node.kind === 'group' ? '◆' : initials(name)}</span>
  );
}

const peopleOf = (nodes: OrgNodeView[], ids: string[]) => {
  const set = new Set(ids);
  return nodes.filter((n) => set.has(n.id) && profileIdOf(n));
};

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${tone ?? 'text-neutral-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-500">{sub}</p>}
    </div>
  );
}

function Tiles({ m }: { m: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Tile label="Leads generated" value={String(m.leads)} sub={`${m.registrations.total} registrations, ${m.enquiries.total} enquiries`} />
      <Tile label="Admissions (won)" value={String(m.won)} tone="text-green-700" sub={`Conversion ${pct(m.conversion)}`} />
      <Tile label="Open" value={String(m.open)} tone="text-amber-700" sub="Still being worked" />
      <Tile label="Lost" value={String(m.lost)} tone="text-neutral-700" sub="Enquiries marked lost" />
      <div className="col-span-2"><Tile label="Fees collected" value={inr0(m.fees)} sub="Paid amounts recorded on registrations" /></div>
    </div>
  );
}

function Trend({ data }: { data: { week: string; leads: number; admissions: number }[] }) {
  if (data.length < 2) return <p className="text-xs text-neutral-500">Not enough weeks yet for a trend.</p>;
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(w: string) => w.slice(5)} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip labelFormatter={(w) => `Week of ${String(w)}`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="leads" name="Leads" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="admissions" name="Admissions" stroke="#16a34a" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The panel that opens when a node is clicked: that person's (or team's) leads, admissions and how they compare. */
export function NodeDrawer({ node, nodes, summary, periodLabel, writable, onEdit, onClose, onSelect }: {
  node: OrgNodeView;
  nodes: OrgNodeView[];
  summary: KpiSummary | null;
  periodLabel: string;
  writable: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const subtree = useMemo(() => subtreeIds(nodes, node.id), [nodes, node.id]);
  const teamPeople = useMemo(() => peopleOf(nodes, subtree), [nodes, subtree]);
  const pid = profileIdOf(node);
  const teamIds = teamPeople.map((n) => profileIdOf(n) as string);
  const hasTeam = subtree.length > 1;
  const own = pid ? metricsFor(summary, [pid]) : null;
  const team = metricsFor(summary, teamIds);
  const shown = own && !hasTeam ? own : own ?? team;
  const everyone = useMemo(() => nodes.filter((n) => profileIdOf(n)), [nodes]);
  const ranks = useMemo(() => {
    if (!pid) return null;
    const rows = everyone.map((n) => ({ id: profileIdOf(n) as string, m: metricsFor(summary, [profileIdOf(n) as string]) }));
    const rankBy = (f: (m: Metrics) => number) => 1 + rows.filter((r) => f(r.m) > f(metricsFor(summary, [pid]))).length;
    const avgLeads = rows.length ? rows.reduce((n, r) => n + r.m.leads, 0) / rows.length : 0;
    const avgWon = rows.length ? rows.reduce((n, r) => n + r.m.won, 0) / rows.length : 0;
    return { of: rows.length, leads: rankBy((m) => m.leads), won: rankBy((m) => m.won), avgLeads, avgWon };
  }, [everyone, summary, pid]);
  const series = useMemo(() => weeklySeries(summary, own && !hasTeam ? [pid] : teamIds.length ? teamIds : [pid]), [summary, own, hasTeam, pid, teamIds]);
  const reports = nodes.filter((n) => n.parent_id === node.id);

  return (
    <aside className="flex max-h-[calc(100vh-9rem)] w-full flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-start gap-3 border-b border-black/5 p-4">
        <Avatar node={node} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-neutral-900">{displayName(node)}</p>
          <p className="truncate text-sm text-neutral-500">{node.title || sourceLabel(node)}</p>
          {(node.profile?.email || node.employee?.email) && <p className="truncate text-xs text-neutral-400">{node.profile?.email || node.employee?.email}</p>}
          {node.is_external && <p className="mt-0.5 text-xs text-amber-700">{hasEnded(node) ? 'Ended' : 'Temporary'}{node.until ? `, until ${new Date(`${node.until}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}, from outside the organisation</p>}
        </div>
        <div className="flex gap-1">
          {writable && <Button variant="ghost" title="Edit this node" onClick={onEdit}><Pencil size={15} /></Button>}
          <Button variant="ghost" title="Close" onClick={onClose}><X size={16} /></Button>
        </div>
      </div>

      <div className="space-y-5 overflow-y-auto p-4">
        <p className="text-xs text-neutral-500">Leads created in: <b>{periodLabel}</b>. A lead is an admission request: a registration or a website enquiry.</p>

        {!pid && !hasTeam ? (
          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
            {node.is_external
              ? 'This person is from outside the organisation, so they have no lead numbers.'
              : node.employee
                ? 'This HR record has no login account, so leads cannot be credited to them. Link their account on the HR record to see numbers.'
                : 'This box is not linked to an account, so it has no lead numbers of its own.'}
            {writable ? ' You can change who this box is with the edit button.' : ''}
          </div>
        ) : (
          <>
            {own && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-neutral-900">{node.kind === 'group' ? 'Team' : 'Their own leads'}</h3>
                <Tiles m={shown} />
              </section>
            )}
            {hasTeam && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-neutral-900">Whole team ({teamPeople.length} {teamPeople.length === 1 ? 'person' : 'people'})</h3>
                <Tiles m={team} />
              </section>
            )}
            {ranks && ranks.of > 1 && own && (
              <section className="rounded-2xl border border-white/70 bg-white/60 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-neutral-900"><Trophy size={15} className="text-amber-500" /> How they compare</p>
                <p className="mt-1 text-neutral-600">#{ranks.leads} of {ranks.of} for leads generated and #{ranks.won} of {ranks.of} for admissions.</p>
                <p className="text-xs text-neutral-500">Average per person: {ranks.avgLeads.toFixed(1)} leads, {ranks.avgWon.toFixed(1)} admissions.</p>
              </section>
            )}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">Week by week</h3>
              <Trend data={series} />
            </section>
          </>
        )}

        {reports.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Direct reports</h3>
            <ul className="space-y-1.5">
              {reports.map((r) => {
                const ids = peopleOf(nodes, subtreeIds(nodes, r.id)).map((n) => profileIdOf(n) as string);
                const m = metricsFor(summary, ids);
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => onSelect(r.id)} className="flex w-full items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-2.5 py-2 text-left hover:bg-white">
                      <Avatar node={r} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{displayName(r)}</span>
                      <span className="text-xs tabular-nums text-neutral-500">{m.leads} leads · {m.won} won</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {node.note && <p className="rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-600">{node.note}</p>}
        {pid && (
          <p className="text-xs text-neutral-500">
            Leads are credited to a person on the <Link to="/admin/registrations" className="text-blue-600 hover:underline">Registrations</Link> page (Lead owner) and in <Link to="/admin/enquiries" className="text-blue-600 hover:underline">Enquiries</Link> (Assigned to).
          </p>
        )}
      </div>
    </aside>
  );
}

type SortKey = 'leads' | 'won' | 'conversion' | 'fees';
const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'leads', label: 'Leads generated', hint: 'Total leads, split into admissions, open and lost' },
  { key: 'won', label: 'Admissions', hint: 'Leads that became admissions' },
  { key: 'conversion', label: 'Conversion', hint: 'Admissions as a share of leads' },
  { key: 'fees', label: 'Fees collected', hint: 'Payments recorded as paid' },
];
const COLOR = { won: '#16a34a', open: '#f59e0b', lost: '#94a3b8', bar: '#2563eb' };

function KpiCard({ icon, label, value, sub, tone = 'text-neutral-900' }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm">
      <div className="flex items-center justify-between text-neutral-400">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
        {icon}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function RankBadge({ n }: { n: number }) {
  const tone = n === 1 ? 'bg-amber-100 text-amber-800' : n === 2 ? 'bg-slate-200 text-slate-700' : n === 3 ? 'bg-orange-100 text-orange-800' : 'bg-transparent text-neutral-400';
  return <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${tone}`}>{n}</span>;
}

function ConversionPill({ value, leads }: { value: number; leads: number }) {
  if (!leads) return <span className="text-neutral-400">-</span>;
  const tone = value >= 0.9 ? 'bg-green-100 text-green-800' : value >= 0.6 ? 'bg-blue-100 text-blue-800' : value >= 0.3 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-block min-w-[3.5rem] rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${tone}`}>{pct(value)}</span>;
}

interface Row {
  node: OrgNodeView;
  name: string;
  m: Metrics;
}

function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: Row & { label: string } }[] }) {
  if (!active || !payload?.length) return null;
  const { name, m } = payload[0].payload;
  const line = (k: string, v: string, color?: string) => (
    <div className="flex items-center justify-between gap-6 text-xs">
      <span className="flex items-center gap-1.5 text-neutral-500">{color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}{k}</span>
      <span className="font-medium tabular-nums text-neutral-900">{v}</span>
    </div>
  );
  return (
    <div className="min-w-[200px] rounded-xl border border-black/5 bg-white p-3 shadow-lg">
      <p className="mb-1.5 text-sm font-semibold text-neutral-900">{name}</p>
      <div className="space-y-1">
        {line('Leads generated', String(m.leads))}
        {line('Admissions', String(m.won), COLOR.won)}
        {line('Open', String(m.open), COLOR.open)}
        {line('Lost', String(m.lost), COLOR.lost)}
        <div className="my-1 border-t border-black/5" />
        {line('Conversion', pct(m.conversion))}
        {line('Fees collected', inr0(m.fees))}
      </div>
    </div>
  );
}

/** Everyone side by side: who took more leads, who closed more, who converts best. */
export function ComparePanel({ people, summary, unassigned, periodLabel, onSelect }: {
  people: OrgNodeView[];
  summary: KpiSummary | null;
  unassigned: Metrics | null;
  periodLabel: string;
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>('leads');
  const rows = useMemo<Row[]>(
    () => people.map((n) => ({ node: n, name: displayName(n), m: metricsFor(summary, [profileIdOf(n) as string]) })).sort((a, b) => b.m[sort] - a.m[sort] || a.name.localeCompare(b.name)),
    [people, summary, sort],
  );

  if (!people.length) return <GlassCard className="p-5 text-sm text-neutral-600">Add people linked to accounts to compare them.</GlassCard>;

  const total = rows.reduce(
    (t, r) => ({ leads: t.leads + r.m.leads, open: t.open + r.m.open, won: t.won + r.m.won, lost: t.lost + r.m.lost, fees: t.fees + r.m.fees }),
    { leads: 0, open: 0, won: 0, lost: 0, fees: 0 },
  );
  const conversion = total.leads ? total.won / total.leads : 0;
  const top = rows[0];
  const sortLabel = SORTS.find((s) => s.key === sort)!;
  const best = Math.max(1, ...rows.map((r) => r.m[sort]));

  const chartData = rows.map((r) => ({
    ...r, label: r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name,
    leads: r.m.leads, won: r.m.won, open: r.m.open, lost: r.m.lost, pad: 0.0001, conversion: Math.round(r.m.conversion * 1000) / 10, fees: r.m.fees,
  }));
  const valueFmt = (v: unknown) => (sort === 'conversion' ? `${v}%` : sort === 'fees' ? inr0(Number(v)) : String(v));

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Team performance</h2>
          <p className="text-sm text-neutral-500">Leads created in {periodLabel.toLowerCase()}, {people.length} {people.length === 1 ? 'person' : 'people'}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard icon={<Target size={16} />} label="Leads generated" value={String(total.leads)} sub={`${total.open} still open`} />
        <KpiCard icon={<BadgeCheck size={16} />} label="Admissions" value={String(total.won)} tone="text-green-700" sub={`${total.lost} lost`} />
        <KpiCard icon={<Percent size={16} />} label="Conversion" value={pct(conversion)} sub="Admissions ÷ leads" />
        <KpiCard icon={<IndianRupee size={16} />} label="Fees collected" value={inr0(total.fees)} sub={total.won ? `${inr0(total.fees / total.won)} per admission` : undefined} />
        <KpiCard icon={<Trophy size={16} className="text-amber-500" />} label={`Top: ${sortLabel.label.toLowerCase()}`} value={top && top.m[sort] > 0 ? top.name.split(' ')[0] : '-'} sub={top && top.m[sort] > 0 ? valueFmt(sort === 'conversion' ? Math.round(top.m.conversion * 1000) / 10 : top.m[sort]) : 'No data yet'} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Ranking by {sortLabel.label.toLowerCase()}</p>
          <p className="text-xs text-neutral-500">{sortLabel.hint}</p>
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-black/5 p-1">
          {SORTS.map((s) => (
            <button key={s.key} type="button" onClick={() => setSort(s.key)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${sort === s.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ height: Math.max(150, rows.length * 46 + 50) }} className="rounded-2xl border border-white/70 bg-white/50 px-2 py-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }} barCategoryGap={14}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (sort === 'fees' ? `₹${v >= 100000 ? `${Math.round(v / 1000) / 100}L` : v >= 1000 ? `${v / 1000}k` : v}` : sort === 'conversion' ? `${v}%` : String(v))} domain={sort === 'conversion' ? [0, 100] : [0, 'auto']} />
            <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: '#262626' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
            {sort === 'leads' ? (
              <>
                <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
                <Bar dataKey="won" name="Admissions" stackId="l" fill={COLOR.won} />
                <Bar dataKey="open" name="Open" stackId="l" fill={COLOR.open} />
                <Bar dataKey="lost" name="Lost" stackId="l" fill={COLOR.lost} />
                <Bar dataKey="pad" legendType="none" stackId="l" fill="transparent" isAnimationActive={false}>
                  <LabelList dataKey="leads" position="right" offset={8} style={{ fontSize: 12, fontWeight: 600, fill: '#262626' }} />
                </Bar>
              </>
            ) : (
              <Bar dataKey={sort} name={sortLabel.label} fill={COLOR.bar} radius={[0, 6, 6, 0]} maxBarSize={26}>
                <LabelList dataKey={sort} position="right" formatter={valueFmt} style={{ fontSize: 12, fontWeight: 600, fill: '#262626' }} />
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm [&_td]:px-2 [&_th]:px-2">
          <thead>
            <tr className="border-b border-black/10 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="w-10 pb-2.5">Rank</th>
              <th className="pb-2.5">Person</th>
              <th className="pb-2.5 text-right">Leads</th>
              <th className="pb-2.5 text-right">Share</th>
              <th className="pb-2.5 text-right">Open</th>
              <th className="pb-2.5 text-right">Admissions</th>
              <th className="pb-2.5 text-right">Lost</th>
              <th className="pb-2.5 text-right">Conversion</th>
              <th className="pb-2.5 text-right">Fees collected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.node.id} className="border-b border-black/5 transition-colors hover:bg-white/60">
                <td className="py-3"><RankBadge n={i + 1} /></td>
                <td className="py-3 pr-3">
                  <button type="button" onClick={() => onSelect(r.node.id)} className="flex items-center gap-3 text-left">
                    <Avatar node={r.node} size={34} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-neutral-900 hover:underline">{r.name}</span>
                      <span className="block truncate text-xs text-neutral-500">{r.node.title || sourceLabel(r.node)}</span>
                    </span>
                  </button>
                  <div className="mt-1.5 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-neutral-100"><div className="h-1 rounded-full" style={{ width: `${(r.m[sort] / best) * 100}%`, background: COLOR.bar }} /></div>
                </td>
                <td className="py-3 text-right font-semibold tabular-nums text-neutral-900">{r.m.leads}</td>
                <td className="py-3 text-right tabular-nums text-neutral-500">{total.leads ? pct(r.m.leads / total.leads) : '-'}</td>
                <td className="py-3 text-right tabular-nums text-amber-700">{r.m.open}</td>
                <td className="py-3 text-right tabular-nums font-medium text-green-700">{r.m.won}</td>
                <td className="py-3 text-right tabular-nums text-neutral-500">{r.m.lost}</td>
                <td className="py-3 text-right"><ConversionPill value={r.m.conversion} leads={r.m.leads} /></td>
                <td className="py-3 text-right tabular-nums text-neutral-900">{inr0(r.m.fees)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black/10 text-sm font-semibold text-neutral-900">
              <td className="py-3" />
              <td className="py-3">Team total</td>
              <td className="py-3 text-right tabular-nums">{total.leads}</td>
              <td className="py-3 text-right tabular-nums text-neutral-500">{total.leads ? '100%' : '-'}</td>
              <td className="py-3 text-right tabular-nums text-amber-700">{total.open}</td>
              <td className="py-3 text-right tabular-nums text-green-700">{total.won}</td>
              <td className="py-3 text-right tabular-nums text-neutral-500">{total.lost}</td>
              <td className="py-3 text-right"><ConversionPill value={conversion} leads={total.leads} /></td>
              <td className="py-3 text-right tabular-nums">{inr0(total.fees)}</td>
            </tr>
            {unassigned && unassigned.leads > 0 && (
              <tr className="text-xs text-neutral-500">
                <td className="pb-1 pt-2" />
                <td className="pb-1 pt-2 italic">Not credited to anyone yet</td>
                <td className="pb-1 pt-2 text-right tabular-nums">{unassigned.leads}</td>
                <td className="pb-1 pt-2" />
                <td className="pb-1 pt-2 text-right tabular-nums">{unassigned.open}</td>
                <td className="pb-1 pt-2 text-right tabular-nums">{unassigned.won}</td>
                <td className="pb-1 pt-2 text-right tabular-nums">{unassigned.lost}</td>
                <td className="pb-1 pt-2 text-right tabular-nums">{pct(unassigned.conversion)}</td>
                <td className="pb-1 pt-2 text-right tabular-nums">{inr0(unassigned.fees)}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-500">Conversion is admissions divided by leads generated. A lead counts as an admission once a registration has been reviewed (accepted or rejected) or an enquiry is marked won. A registration still waiting for review is open.</p>
    </GlassCard>
  );
}
