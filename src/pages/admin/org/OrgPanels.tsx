import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Pencil, Trophy, X } from 'lucide-react';
import { GlassCard } from '../../../components/ui/shared';
import { Button } from '../../../components/ui/kit';
import { inr } from '../../../lib/quotations';
import {
  ACCENTS, displayName, hasEnded, initials, metricsFor, pct, photoOf, profileIdOf, sourceLabel, subtreeIds, weeklySeries,
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
      <div className="col-span-2"><Tile label="Fees collected" value={inr(m.fees)} sub="Paid amounts on accepted registrations" /></div>
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
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'leads', label: 'Leads generated' },
  { key: 'won', label: 'Admissions' },
  { key: 'conversion', label: 'Conversion' },
  { key: 'fees', label: 'Fees collected' },
];

/** Everyone side by side: who took more leads, who closed more, who converts best. */
export function ComparePanel({ people, summary, unassigned, periodLabel, onSelect }: {
  people: OrgNodeView[];
  summary: KpiSummary | null;
  unassigned: Metrics | null;
  periodLabel: string;
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>('leads');
  const rows = useMemo(
    () => people.map((n) => ({ node: n, name: displayName(n), m: metricsFor(summary, [profileIdOf(n) as string]) })).sort((a, b) => b.m[sort] - a.m[sort] || a.name.localeCompare(b.name)),
    [people, summary, sort],
  );
  const chart = rows.map((r) => ({ name: r.name.split(' ')[0], Leads: r.m.leads, Admissions: r.m.won, Open: r.m.open }));
  const best = Math.max(1, ...rows.map((r) => r.m[sort]));

  if (!people.length) return <GlassCard className="p-5 text-sm text-neutral-600">Add people linked to staff accounts to compare them.</GlassCard>;
  return (
    <GlassCard className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-neutral-900">Who took more leads</h2>
          <p className="text-xs text-neutral-500">{periodLabel}, {people.length} people</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <button key={s.key} type="button" onClick={() => setSort(s.key)} className={`rounded-full px-3 py-1 text-xs font-medium ${sort === s.key ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-700 hover:bg-white'}`}>{s.label}</button>
          ))}
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Leads" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Admissions" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Open" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr><th className="pb-2 font-medium">#</th><th className="pb-2 font-medium">Person</th><th className="pb-2 text-right font-medium">Leads</th><th className="pb-2 text-right font-medium">Open</th><th className="pb-2 text-right font-medium">Admissions</th><th className="pb-2 text-right font-medium">Lost</th><th className="pb-2 text-right font-medium">Conversion</th><th className="pb-2 text-right font-medium">Fees</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.node.id} className="border-t border-black/5">
                <td className="py-2 pr-2 text-neutral-400">{i + 1}</td>
                <td className="py-2 pr-3">
                  <button type="button" onClick={() => onSelect(r.node.id)} className="flex items-center gap-2 text-left hover:underline">
                    <Avatar node={r.node} size={26} /><span className="text-neutral-900">{r.name}</span>
                  </button>
                  <div className="mt-1 h-1 w-full max-w-[160px] rounded bg-neutral-100"><div className="h-1 rounded bg-blue-500" style={{ width: `${(r.m[sort] / best) * 100}%` }} /></div>
                </td>
                <td className="py-2 text-right tabular-nums">{r.m.leads}</td>
                <td className="py-2 text-right tabular-nums text-amber-700">{r.m.open}</td>
                <td className="py-2 text-right tabular-nums text-green-700">{r.m.won}</td>
                <td className="py-2 text-right tabular-nums text-neutral-500">{r.m.lost}</td>
                <td className="py-2 text-right tabular-nums">{pct(r.m.conversion)}</td>
                <td className="py-2 text-right tabular-nums">{inr(r.m.fees)}</td>
              </tr>
            ))}
            {unassigned && unassigned.leads > 0 && (
              <tr className="border-t border-black/5 text-neutral-500">
                <td className="py-2" /><td className="py-2 pr-3 italic">No owner yet</td>
                <td className="py-2 text-right tabular-nums">{unassigned.leads}</td><td className="py-2 text-right tabular-nums">{unassigned.open}</td><td className="py-2 text-right tabular-nums">{unassigned.won}</td><td className="py-2 text-right tabular-nums">{unassigned.lost}</td><td className="py-2 text-right tabular-nums">{pct(unassigned.conversion)}</td><td className="py-2 text-right tabular-nums">{inr(unassigned.fees)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Conversion is admissions divided by leads generated. A lead counts as an admission once a registration has been reviewed (accepted or rejected) or an enquiry is marked won. A registration still waiting for review is open.</p>
    </GlassCard>
  );
}
