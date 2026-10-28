import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, useNodesState,
  type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowDownUp, ArrowLeftRight, GitFork, Network, Pencil, Plus, Settings2, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminAccess } from '../../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../../lib/useQuery';
import {
  ACCENTS, NODE_H, NODE_W, PERIOD_LABEL, displayName, layoutTree, metricsFor, periodRange, subtreeIds,
  type Direction, type KpiSummary, type OrgChart, type OrgNodeView, type Period,
} from '../../../lib/orgChart';
import { GlassCard } from '../../../components/ui/shared';
import { Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../../components/ui/kit';
import { Avatar, ComparePanel, NodeDrawer } from './OrgPanels';
import { OrgNodeModal, type StaffOption } from './OrgNodeModal';

interface CardData extends Record<string, unknown> {
  node: OrgNodeView;
  leads: number;
  won: number;
  teamLeads: number | null;
  hasNumbers: boolean;
  direction: Direction;
  selected: boolean;
  editing: boolean;
}

function OrgCard({ data }: NodeProps<Node<CardData>>) {
  const { node, leads, won, teamLeads, hasNumbers, direction, selected, editing } = data;
  const lr = direction === 'LR';
  return (
    <div style={{ width: NODE_W, height: NODE_H }} className={`flex items-center gap-3 rounded-2xl border-2 bg-white/95 px-3 shadow-md transition-shadow ${ACCENTS[node.accent].ring} ${selected ? 'shadow-xl ring-4 ring-blue-200' : ''} ${editing ? 'cursor-grab' : 'cursor-pointer'}`}>
      <Handle type="target" position={lr ? Position.Left : Position.Top} className="!h-2 !w-2 !border-0 !bg-neutral-300" />
      <Avatar node={node} size={46} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">{displayName(node)}</p>
        <p className="truncate text-xs text-neutral-500">{node.title || (node.kind === 'group' ? 'Team' : node.profile?.role ?? '')}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {hasNumbers ? (
            <>
              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{leads} leads</span>
              <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">{won} admitted</span>
              {teamLeads !== null && node.profile_id && <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">team {teamLeads}</span>}
            </>
          ) : (
            <span className="text-[10px] text-neutral-400">No account linked</span>
          )}
        </div>
      </div>
      <Handle type="source" position={lr ? Position.Right : Position.Bottom} className="!h-2 !w-2 !border-0 !bg-neutral-300" />
    </div>
  );
}
const nodeTypes = { org: OrgCard };

const STAFF_ROLES = ['super_admin', 'admin', 'coordinator', 'instructor'] as const;
const readDirection = (): Direction => {
  try {
    return localStorage.getItem('org-direction') === 'LR' ? 'LR' : 'TB';
  } catch {
    return 'TB';
  }
};

export function OrgTree() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('org-tree');
  const [chartId, setChartId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('90d');
  const [direction, setDirection] = useState<Direction>(readDirection);
  const [view, setView] = useState<'tree' | 'compare'>('tree');
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ node: OrgNodeView | null; parent: string | null } | null>(null);
  const [chartModal, setChartModal] = useState<'new' | 'edit' | null>(null);
  const [busy, setBusy] = useState(false);

  const charts = useQuery(() => unwrap(supabase.from('org_charts').select('*').order('created_at')) as Promise<OrgChart[]>, []);
  useEffect(() => {
    if (charts.data && charts.data.length && !charts.data.some((c) => c.id === chartId)) setChartId(charts.data[0].id);
    if (charts.data && !charts.data.length) setChartId(null);
  }, [charts.data, chartId]);

  const nodesQ = useQuery(async () => {
    if (!chartId) return [] as OrgNodeView[];
    return (await unwrap(
      supabase.from('org_nodes').select('id, chart_id, parent_id, kind, profile_id, label, title, image_url, note, accent, sort_order, profile:profiles!org_nodes_profile_id_fkey(id, full_name, email, avatar_url, role, status)').eq('chart_id', chartId),
    )) as OrgNodeView[];
  }, [chartId]);
  const staffQ = useQuery(async () => {
    const [people, details] = await Promise.all([
      unwrap(supabase.from('profiles').select('id, full_name, email, avatar_url, role, status').in('role', STAFF_ROLES).eq('status', 'active').is('archived_at', null).order('full_name')) as Promise<StaffOption[]>,
      unwrap(supabase.from('staff_details').select('profile_id, designation')) as Promise<{ profile_id: string; designation: string }[]>,
    ]);
    const d = new Map(details.map((x) => [x.profile_id, x.designation] as const));
    return people.map((p) => ({ ...p, designation: d.get(p.id) ?? '' }));
  }, []);
  const kpiQ = useQuery(async () => {
    const { from, to } = periodRange(period);
    const { data, error } = await supabase.rpc('org_kpi_summary', { p_from: from ?? undefined, p_to: to ?? undefined });
    if (error) throw new Error(error.message);
    return data as unknown as KpiSummary;
  }, [period]);

  const nodes = useMemo(() => nodesQ.data ?? [], [nodesQ.data]);
  const summary = kpiQ.data;
  const chart = charts.data?.find((c) => c.id === chartId) ?? null;
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const positions = useMemo(() => layoutTree(nodes, direction), [nodes, direction]);
  const flowNodes = useMemo<Node<CardData>[]>(
    () =>
      nodes.map((n) => {
        const sub = subtreeIds(nodes, n.id);
        const teamIds = nodes.filter((x) => sub.includes(x.id) && x.profile_id).map((x) => x.profile_id as string);
        const own = n.profile_id ? metricsFor(summary, [n.profile_id]) : null;
        const team = sub.length > 1 ? metricsFor(summary, teamIds) : null;
        const shown = own ?? team ?? metricsFor(summary, []);
        return {
          id: n.id, type: 'org', position: positions.get(n.id) ?? { x: 0, y: 0 }, draggable: editing && writable,
          data: { node: n, leads: shown.leads, won: shown.won, teamLeads: own && team ? team.leads : null, hasNumbers: !!(own || team), direction, selected: n.id === selectedId, editing },
        };
      }),
    [nodes, positions, summary, direction, selectedId, editing, writable],
  );
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node<CardData>>([]);
  useEffect(() => setRfNodes(flowNodes), [flowNodes, setRfNodes]);

  const edges = useMemo<Edge[]>(
    () => nodes.filter((n) => n.parent_id && nodes.some((p) => p.id === n.parent_id)).map((n) => ({
      id: `${n.parent_id}-${n.id}`, source: n.parent_id as string, target: n.id, type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#a3a3a3' }, style: { stroke: '#a3a3a3', strokeWidth: 1.5 },
    })),
    [nodes],
  );

  const refreshNodes = useCallback(() => nodesQ.refetch(), [nodesQ]);

  // Drop a box on another to make it report to that person.
  const onDragStop = useCallback(
    async (_: unknown, dragged: Node) => {
      const me = nodes.find((n) => n.id === dragged.id);
      if (!me || !writable) return;
      const cx = dragged.position.x + NODE_W / 2;
      const cy = dragged.position.y + NODE_H / 2;
      const below = new Set(subtreeIds(nodes, me.id));
      const target = nodes.find((n) => {
        if (below.has(n.id)) return false;
        const p = positions.get(n.id);
        return !!p && cx >= p.x && cx <= p.x + NODE_W && cy >= p.y && cy <= p.y + NODE_H;
      });
      if (target && target.id !== me.parent_id) {
        const { error } = await supabase.from('org_nodes').update({ parent_id: target.id }).eq('id', me.id);
        if (error) toast(error.message, 'error');
        else toast(`${displayName(me)} now reports to ${displayName(target)}`);
        refreshNodes();
      } else {
        setRfNodes(flowNodes); // dropped on nothing: snap back
      }
    },
    [nodes, positions, writable, toast, refreshNodes, setRfNodes, flowNodes],
  );

  const period$ = PERIOD_LABEL[period];
  const unassigned = useMemo(() => (summary ? metricsFor(summary, [null]) : null), [summary]);
  const people = useMemo(() => nodes.filter((n) => n.profile_id), [nodes]);

  const setDir = (d: Direction) => {
    setDirection(d);
    try {
      localStorage.setItem('org-direction', d);
    } catch {
      /* the setting just is not remembered */
    }
  };

  const addEveryone = async () => {
    if (!chartId || !staffQ.data?.length) return;
    if (!confirm(`Add all ${staffQ.data.length} active staff accounts to this chart? Super admins go at the top and everyone else under the first one. You can then drag people to the right managers.`)) return;
    setBusy(true);
    const sorted = [...staffQ.data].sort((a, b) => (a.role === 'super_admin' ? 0 : 1) - (b.role === 'super_admin' ? 0 : 1));
    const top = sorted[0];
    const { data: first, error } = await supabase.from('org_nodes').insert({ chart_id: chartId, kind: 'person', profile_id: top.id, title: top.designation || (top.role === 'super_admin' ? 'Founder' : ''), accent: 'blue' }).select('id').single();
    if (error || !first) {
      setBusy(false);
      return toast(error?.message ?? 'Could not add people', 'error');
    }
    const rest = sorted.slice(1).map((s) => ({ chart_id: chartId, kind: 'person', profile_id: s.id, parent_id: (first as { id: string }).id, title: s.designation }));
    if (rest.length) {
      const { error: e2 } = await supabase.from('org_nodes').insert(rest);
      if (e2) toast(e2.message, 'error');
    }
    setBusy(false);
    refreshNodes();
  };

  const creditPast = async () => {
    if (!confirm('Credit past registrations that have no lead owner to the staff member who accepted or reviewed them? Registrations that already have an owner are not changed.')) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('org_credit_reviewers');
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(`${data ?? 0} registration${data === 1 ? '' : 's'} credited`);
    kpiQ.refetch();
  };

  if (charts.loading && !charts.data) return <Spinner />;
  if (charts.error) return <EmptyState icon={<Network size={22} />} title="Could not load the org tree" description={charts.error} />;

  return (
    <div>
      <PageHeader
        title="Org tree"
        subtitle="Who reports to whom, and how each person is doing on leads and admissions. Click anyone to see their numbers."
        actions={writable && <Button onClick={() => setChartModal('new')}><Plus size={15} /> New chart</Button>}
      />

      {!charts.data?.length ? (
        <EmptyState icon={<Network size={22} />} title="No charts yet" description={writable ? 'Make a chart for the company, or for a team such as admissions or marketing. You can have as many as you like.' : undefined} action={writable ? <Button onClick={() => setChartModal('new')}>Create the first chart</Button> : undefined} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {charts.data.map((c) => (
              <button key={c.id} onClick={() => { setChartId(c.id); setSelectedId(null); }} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${c.id === chartId ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-700 hover:bg-white'}`}>{c.name}</button>
            ))}
            {writable && chart && <Button variant="ghost" title="Rename or delete this chart" onClick={() => setChartModal('edit')}><Settings2 size={15} /></Button>}
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-full bg-black/5 p-1 text-sm">
              <button type="button" onClick={() => setView('tree')} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${view === 'tree' ? 'bg-white font-medium shadow-sm' : 'text-neutral-600'}`}><GitFork size={14} /> Tree</button>
              <button type="button" onClick={() => setView('compare')} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${view === 'compare' ? 'bg-white font-medium shadow-sm' : 'text-neutral-600'}`}><Users size={14} /> Compare</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="!w-auto !py-1.5">
                {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
              </Select>
              {view === 'tree' && (
                <div className="inline-flex rounded-full bg-black/5 p-1 text-sm">
                  <button type="button" title="Top to bottom" onClick={() => setDir('TB')} className={`rounded-full px-2.5 py-1 ${direction === 'TB' ? 'bg-white shadow-sm' : 'text-neutral-600'}`}><ArrowDownUp size={14} /></button>
                  <button type="button" title="Left to right" onClick={() => setDir('LR')} className={`rounded-full px-2.5 py-1 ${direction === 'LR' ? 'bg-white shadow-sm' : 'text-neutral-600'}`}><ArrowLeftRight size={14} /></button>
                </div>
              )}
              {writable && view === 'tree' && (
                <>
                  <Button variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing((e) => !e)}><Pencil size={14} /> {editing ? 'Done editing' : 'Edit chart'}</Button>
                  {editing && <Button variant="secondary" onClick={() => setModal({ node: null, parent: selected?.id ?? null })}><Plus size={14} /> Add{selected ? ` under ${displayName(selected).split(' ')[0]}` : ''}</Button>}
                </>
              )}
            </div>
          </div>

          {kpiQ.error && <p className="mb-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">Could not load the numbers: {kpiQ.error}</p>}
          {unassigned && unassigned.leads > 0 && (
            <GlassCard className="mb-3 flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="text-neutral-700"><b>{unassigned.leads}</b> lead{unassigned.leads === 1 ? ' has' : 's have'} no owner in this period ({unassigned.won} admission{unassigned.won === 1 ? '' : 's'}), so nobody is credited yet. Set <Link to="/admin/registrations" className="text-blue-600 hover:underline">Lead owner</Link> on a registration or assign an <Link to="/admin/enquiries" className="text-blue-600 hover:underline">enquiry</Link>.</span>
              {writable && unassigned.registrations.total > 0 && <Button variant="secondary" disabled={busy} onClick={() => void creditPast()}>Credit past admissions to who accepted them</Button>}
            </GlassCard>
          )}

          {view === 'compare' ? (
            <ComparePanel people={people} summary={summary ?? null} unassigned={unassigned} periodLabel={period$} onSelect={(id) => { setSelectedId(id); setView('tree'); }} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="relative h-[calc(100vh-17rem)] min-h-[460px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/50">
                {nodesQ.loading && !nodesQ.data ? (
                  <Spinner />
                ) : !nodes.length ? (
                  <div className="flex h-full items-center justify-center p-6">
                    <EmptyState icon={<Network size={22} />} title="This chart is empty" description={writable ? 'Add people one by one, or start with everyone on your staff list.' : undefined} action={writable ? <div className="flex gap-2"><Button onClick={() => setModal({ node: null, parent: null })}>Add the first box</Button><Button variant="secondary" onClick={() => void addEveryone()} disabled={busy}>Add all staff</Button></div> : undefined} />
                  </div>
                ) : (
                  <ReactFlow
                    key={`${chartId}-${direction}`}
                    nodes={rfNodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onNodeClick={(_, n) => setSelectedId(n.id)}
                    onPaneClick={() => setSelectedId(null)}
                    onNodeDragStop={(e, n) => void onDragStop(e, n)}
                    nodesConnectable={false}
                    fitView
                    fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                    minZoom={0.15}
                    maxZoom={1.6}
                  >
                    <Background gap={22} color="#e5e7eb" />
                    <Controls showInteractive={false} />
                    <MiniMap pannable zoomable className="!hidden md:!block" nodeColor="#cbd5e1" />
                  </ReactFlow>
                )}
                {editing && nodes.length > 0 && <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs text-neutral-600 shadow">Drag a box onto its manager to change who it reports to.</p>}
              </div>

              <div>
                {selected ? (
                  <NodeDrawer
                    node={selected} nodes={nodes} summary={summary ?? null} periodLabel={period$} writable={writable && editing}
                    onEdit={() => setModal({ node: selected, parent: null })} onClose={() => setSelectedId(null)} onSelect={setSelectedId}
                  />
                ) : (
                  <GlassCard className="p-5 text-sm text-neutral-600">
                    <p className="font-medium text-neutral-900">Click a person or team</p>
                    <p className="mt-1">You will see how many leads they generated, how many are still open, how many became admissions, their conversion and the fees collected, week by week and compared with the rest of the team.</p>
                    {writable && !editing && <p className="mt-3 text-xs text-neutral-500">To change the chart, press “Edit chart”.</p>}
                  </GlassCard>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {modal && chartId && (
        <OrgNodeModal chartId={chartId} node={modal.node} nodes={nodes} staff={staffQ.data ?? []} defaultParent={modal.parent} onClose={() => setModal(null)} onSaved={() => { setModal(null); refreshNodes(); }} />
      )}
      {chartModal && <ChartModal chart={chartModal === 'edit' ? chart : null} onClose={() => setChartModal(null)} onSaved={(id) => { setChartModal(null); if (id) setChartId(id); charts.refetch(); }} />}
    </div>
  );
}

function ChartModal({ chart, onClose, onSaved }: { chart: OrgChart | null; onClose: () => void; onSaved: (newId?: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState(chart?.name ?? '');
  const [description, setDescription] = useState(chart?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('Give the chart a name.');
    setBusy(true);
    if (chart) {
      const { error: e } = await supabase.from('org_charts').update({ name: name.trim(), description: description.trim() }).eq('id', chart.id);
      setBusy(false);
      if (e) return setError(e.message);
      toast('Saved');
      return onSaved();
    }
    const { data, error: e } = await supabase.from('org_charts').insert({ name: name.trim(), description: description.trim() }).select('id').single();
    setBusy(false);
    if (e || !data) return setError(e?.message ?? 'Could not create the chart');
    toast('Chart created');
    onSaved((data as { id: string }).id);
  };
  const remove = async () => {
    if (!chart || !confirm(`Delete the chart "${chart.name}" and every box in it? The staff accounts are not deleted.`)) return;
    setBusy(true);
    const { error: e } = await supabase.from('org_charts').delete().eq('id', chart.id);
    setBusy(false);
    if (e) return setError(e.message);
    toast('Chart deleted');
    onSaved();
  };
  return (
    <Modal open onClose={onClose} title={chart ? 'Chart settings' : 'New chart'}>
      <div className="space-y-4">
        <Field label="Name" required><TextInput value={name} maxLength={80} onChange={(e) => { setError(null); setName(e.target.value); }} placeholder="e.g. Company, Admissions team" /></Field>
        <Field label="Description" hint="Optional."><TextArea rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex items-center justify-between">
          <div>{chart && <Button variant="secondary" onClick={() => void remove()} disabled={busy}>Delete chart</Button>}</div>
          <div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} loading={busy}>{chart ? 'Save' : 'Create'}</Button></div>
        </div>
      </div>
    </Modal>
  );
}
