import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, MapPin, Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { invokeFn } from '../../lib/functions';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { slugify } from '../../lib/slug';
import type { Tables } from '../../lib/database.types';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import { KIND_LABEL, KIND_TONE, RUN_LABEL, RUN_TONE, fmtDay, runState, type GroupKind, type WorkshopOverview } from '../../lib/workshops';

type Group = Tables<'course_groups'>;

/** Workshops and events, each with its own students, results and reports. Regular batches are listed too. */
export function AdminWorkshops() {
  const nav = useNavigate();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('workshops');
  const [tab, setTab] = useState<'all' | GroupKind>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const q = useQuery(async () => {
    const [groups, overview] = await Promise.all([
      unwrap(supabase.from('course_groups').select('*').order('created_at', { ascending: false })) as Promise<Group[]>,
      supabase.rpc('workshop_overview').then((r) => (r.data ?? []) as unknown as WorkshopOverview[]),
    ]);
    return { groups, overview };
  }, []);

  const stat = useMemo(() => new Map((q.data?.overview ?? []).map((o) => [o.group_id, o])), [q.data]);
  const groups = q.data?.groups ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: groups.length, workshop: 0, event: 0, regular: 0 };
    for (const g of groups) c[g.kind] += 1;
    return c;
  }, [groups]);
  const rows = groups.filter((g) => (tab === 'all' || g.kind === tab) && (!search.trim() || `${g.name} ${g.code} ${g.organizer} ${g.venue}`.toLowerCase().includes(search.trim().toLowerCase())));

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Workshops and events"
        subtitle="Each workshop or event keeps its own students, results and reports. A new one never touches the old ones"
        actions={
          writable && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> New workshop or event
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <TextInput className="!pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find by name, ID or college…" />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {(['all', 'workshop', 'event', 'regular'] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 font-medium ${tab === k ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-600 hover:bg-white'}`}>
              {k === 'all' ? 'Everything' : k === 'workshop' ? 'Workshops' : k === 'event' ? 'Events' : 'Regular batches'} ({counts[k]})
            </button>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <EmptyState icon={<CalendarRange size={22} />} title="Nothing here yet" description="Create a workshop or an event, add its courses and its students, and everything about them stays in one place." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((g) => {
            const s = stat.get(g.id);
            const run = runState(g);
            return (
              <div key={g.id} role="button" tabIndex={0} onClick={() => nav(`/admin/workshops/${g.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/admin/workshops/${g.id}`)} className="cursor-pointer text-left">
                <GlassCard className="h-full p-5 transition-transform hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-neutral-900 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{g.code}</span>
                        <Badge tone={KIND_TONE[g.kind as GroupKind]}>{KIND_LABEL[g.kind as GroupKind]}</Badge>
                        {g.kind !== 'regular' && <Badge tone={RUN_TONE[run]}>{RUN_LABEL[run]}</Badge>}
                      </div>
                      <div className="mt-2 truncate text-lg font-semibold text-neutral-900">{g.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-neutral-500">
                        {g.organizer && <span>{g.organizer}</span>}
                        {g.venue && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} /> {g.venue}
                          </span>
                        )}
                        {(g.starts_on || g.ends_on) && (
                          <span>
                            {fmtDay(g.starts_on)}
                            {g.ends_on && g.ends_on !== g.starts_on ? ` to ${fmtDay(g.ends_on)}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      [s?.students ?? 0, 'Students'],
                      [s?.exam_takers ?? 0, 'Took exam'],
                      [s?.avg_best_score ?? '—', 'Avg score'],
                      [s?.certificates ?? 0, 'Certificates'],
                    ].map(([v, label]) => (
                      <div key={String(label)} className="rounded-xl bg-white/60 px-2 py-2">
                        <div className="text-lg font-semibold text-neutral-900">{v}</div>
                        <div className="text-[11px] text-neutral-500">{label}</div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      )}

      {creating && writable && <NewWorkshop onClose={() => setCreating(false)} onCreated={(id) => nav(`/admin/workshops/${id}`)} />}
    </div>
  );
}

function NewWorkshop({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const [f, setF] = useState({ kind: 'workshop' as 'workshop' | 'event', name: '', organizer: '', venue: '', starts_on: '', ends_on: '', description: '' });
  const [courseIds, setCourseIds] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState('');
  const [busy, setBusy] = useState(false);

  const courses = useQuery(() => unwrap(supabase.from('courses').select('id, title').eq('status', 'published').order('title')) as Promise<{ id: string; title: string }[]>, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (f.name.trim().length < 3) return toast('Give it a name, for example "Sivani Engineering College workshop"', 'error');
    if (f.starts_on && f.ends_on && f.ends_on < f.starts_on) return toast('The end date is before the start date', 'error');
    setBusy(true);
    try {
      const { data: g, error } = await supabase
        .from('course_groups')
        .insert({
          name: f.name.trim(),
          slug: `${slugify(f.name) || 'workshop'}-${crypto.randomUUID().slice(0, 4)}`,
          description: f.description.trim() || null,
          kind: f.kind,
          organizer: f.organizer.trim(),
          venue: f.venue.trim(),
          starts_on: f.starts_on || null,
          ends_on: f.ends_on || null,
          created_by: profile?.id,
        } as never)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      if (courseIds.size) {
        const { error: ce } = await supabase.from('course_group_courses').insert([...courseIds].map((course_id) => ({ group_id: g.id, course_id })));
        if (ce) throw new Error(ce.message);
      }
      const list = people
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [email, ...rest] = l.split(/[,\t]/);
          return { email: email.trim(), full_name: rest.join(' ').trim() };
        });
      if (list.length) {
        const res = await invokeFn<{ created: number; existing: number; skipped: number }>('add-students', { people: list.slice(0, 100), group_ids: [g.id] });
        toast(`Created. ${res.created} new and ${res.existing} existing students added${res.skipped ? `, ${res.skipped} skipped` : ''}`);
      } else toast('Created');
      onCreated(g.id as string);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create it', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New workshop or event" wide>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={f.kind} onChange={set('kind')}>
              <option value="workshop">Workshop</option>
              <option value="event">Event</option>
            </Select>
          </Field>
          <Field label="Name" required>
            <TextInput value={f.name} onChange={set('name')} placeholder="e.g. Sivani Engineering College workshop" autoFocus />
          </Field>
          <Field label="College or organiser">
            <TextInput value={f.organizer} onChange={set('organizer')} placeholder="e.g. Sivani Engineering College" />
          </Field>
          <Field label="Venue">
            <TextInput value={f.venue} onChange={set('venue')} placeholder="City or campus" />
          </Field>
          <Field label="Starts on">
            <TextInput type="date" value={f.starts_on} onChange={set('starts_on')} />
          </Field>
          <Field label="Ends on">
            <TextInput type="date" value={f.ends_on} onChange={set('ends_on')} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <TextArea rows={2} value={f.description} onChange={set('description')} />
        </Field>
        <div>
          <div className="mb-1.5 text-sm font-medium text-neutral-700">Courses this {f.kind} covers</div>
          <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-xl border border-white/70 bg-white/50 p-3 sm:grid-cols-2">
            {(courses.data ?? []).map((c) => (
              <Checkbox
                key={c.id}
                label={c.title}
                checked={courseIds.has(c.id)}
                onChange={(e) =>
                  setCourseIds((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(c.id);
                    else n.delete(c.id);
                    return n;
                  })
                }
              />
            ))}
          </div>
        </div>
        <Field label="Students (optional)" hint="One per line: email, then the name. They get an account, if they do not have one, and access to the courses above. You can add more later.">
          <TextArea rows={5} value={people} onChange={(e) => setPeople(e.target.value)} placeholder={'asha@example.com, Asha Rao\nravi@example.com, Ravi Kumar'} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} loading={busy}>
          Create
        </Button>
      </div>
    </Modal>
  );
}
