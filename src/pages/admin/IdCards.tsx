import { useEffect, useMemo, useState } from 'react';
import { IdCard as IdCardIcon, Send, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
import type { Tables } from '../../lib/database.types';

type CardType = 'student' | 'coordinator' | 'volunteer';
const CARD_TYPES: CardType[] = ['student', 'coordinator', 'volunteer'];
const TYPE_LABEL: Record<CardType, string> = { student: 'Student', coordinator: 'Coordinator', volunteer: 'Volunteer' };

interface Card {
  id: string;
  card_number: string;
  card_type: CardType;
  workshop_name: string | null;
  workshop_location: string | null;
  fee_paid: string | null;
  issued_at: string;
  valid_from: string | null;
  valid_until: string | null;
  last_emailed_at: string | null;
  pdf_path: string;
  student: { id: string; full_name: string; email: string } | null;
  course: { id: string; title: string } | null;
}

type Preset = Tables<'id_card_presets'>;

interface AccountOption {
  id: string;
  full_name: string;
  email: string;
  role: 'student' | 'instructor' | 'super_admin';
  status: 'pending' | 'active' | 'suspended';
}

interface CourseOption {
  id: string;
  title: string;
}

const emptyDraft = () => ({
  student_id: '',
  card_type: 'student' as CardType,
  course_id: '',
  preset_id: '',
  workshop_name: '',
  workshop_location: '',
  fee_paid: '',
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })(),
});

export function IdCards() {
  const { canWrite } = useAdminAccess();
  const writable = canWrite('id-cards');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const q = useQuery<{ cards: Card[]; accounts: AccountOption[]; courses: CourseOption[]; presets: Preset[] }>(async () => {
    const [cards, accounts, courses, presets] = await Promise.all([
      unwrap(
        supabase
          .from('id_cards')
          .select(
            'id, card_number, card_type, workshop_name, workshop_location, fee_paid, issued_at, valid_from, valid_until, ' +
              'last_emailed_at, pdf_path, student:profiles!id_cards_student_id_fkey(id, full_name, email), course:courses(id, title)',
          )
          .order('issued_at', { ascending: false }),
      ) as Promise<Card[]>,
      unwrap(
        // Any non-archived account can hold a card — students, coordinators and volunteers
        // don't necessarily map to the "student" role.
        supabase.from('profiles').select('id, full_name, email, role, status').is('archived_at', null).order('full_name'),
      ) as Promise<AccountOption[]>,
      unwrap(supabase.from('courses').select('id, title').order('title')) as Promise<CourseOption[]>,
      unwrap(supabase.from('id_card_presets').select('*').order('name')) as Promise<Preset[]>,
    ]);
    return { cards, accounts, courses, presets };
  }, []);

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    return (q.data?.cards ?? []).filter(
      (c) =>
        c.card_number.toLowerCase().includes(s) ||
        c.student?.full_name.toLowerCase().includes(s) ||
        c.student?.email.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from('id-cards').createSignedUrl(path, 120);
    if (error || !data) return toast('Could not open the ID card', 'error');
    window.open(data.signedUrl, '_blank');
  };

  const resend = async (c: Card) => {
    setResendingId(c.id);
    try {
      await invokeFn('resend-id-card', { id_card_id: c.id });
      toast(`Resent to ${c.student?.email}`);
      q.refetch();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setResendingId(null);
    }
  };

  const [showGenerate, setShowGenerate] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const set = <K extends keyof ReturnType<typeof emptyDraft>>(k: K, v: ReturnType<typeof emptyDraft>[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Re-open the generate form pre-filled from an existing card, so fixing a typo or
  // picking up a design change is "adjust and click", not re-entering everything.
  const regenerate = (c: Card) => {
    if (!c.student) return;
    setDraft({
      student_id: c.student.id,
      card_type: c.card_type,
      course_id: c.course?.id ?? '',
      preset_id: '',
      workshop_name: c.workshop_name ?? '',
      workshop_location: c.workshop_location ?? '',
      fee_paid: c.fee_paid ?? '',
      valid_from: c.valid_from ?? emptyDraft().valid_from,
      valid_until: c.valid_until ?? emptyDraft().valid_until,
    });
    setShowGenerate(true);
  };

  const applyPreset = (presetId: string) => {
    const p = q.data?.presets.find((x) => x.id === presetId);
    set('preset_id', presetId);
    if (!p) return;
    setDraft((d) => ({
      ...d,
      card_type: (p.card_type as CardType) || d.card_type,
      workshop_name: p.workshop_name ?? d.workshop_name,
      workshop_location: p.workshop_location ?? d.workshop_location,
      valid_from: p.valid_from ?? d.valid_from,
      valid_until: p.valid_until ?? d.valid_until,
    }));
  };

  // Auto-fill the fee from the person's own registration, so the admin doesn't retype it —
  // still editable afterwards for a one-off correction.
  useEffect(() => {
    if (!draft.student_id || draft.card_type !== 'student') return;
    let cancelled = false;
    supabase
      .from('registrations')
      .select('payment_amount, payment_status')
      .eq('created_profile_id', draft.student_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data?.payment_amount) return;
        const status = String(data.payment_status || '').replace(/^./, (c) => c.toUpperCase());
        setDraft((d) => (d.fee_paid ? d : { ...d, fee_paid: `₹${Number(data.payment_amount).toLocaleString('en-IN')}${status ? ` · ${status}` : ''}` }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.student_id, draft.card_type]);

  const generate = async () => {
    if (!draft.student_id) return;
    setGenerating(true);
    try {
      await invokeFn('generate-id-card', {
        student_id: draft.student_id,
        course_id: draft.course_id || null,
        card_type: draft.card_type,
        workshop_name: draft.workshop_name || null,
        workshop_location: draft.workshop_location || null,
        fee_paid: draft.fee_paid || null,
        valid_from: draft.valid_from || null,
        valid_until: draft.valid_until || null,
      });
      toast('ID card generated and emailed');
      setShowGenerate(false);
      setDraft(emptyDraft());
      q.refetch();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="ID Cards"
        subtitle="Student, coordinator and volunteer ID cards — generated automatically for students when a registration is accepted"
        actions={
          <div className="flex items-center gap-2">
            {writable && (
              <>
                <Button variant="ghost" onClick={() => setShowPresets(true)}>
                  Presets
                </Button>
                <Button variant="secondary" onClick={() => setShowGenerate(true)}>
                  <IdCardIcon size={14} /> Generate ID card
                </Button>
              </>
            )}
            <TextInput placeholder="Search ID or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          </div>
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !rows.length ? (
        <EmptyState
          icon={<IdCardIcon size={22} />}
          title="No ID cards yet"
          description="Student cards are issued and emailed automatically when a registration is accepted. Coordinator and volunteer cards are generated here."
        />
      ) : (
        <GlassCard className="overflow-x-auto p-2">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3">Card ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Course / workshop</th>
                <th className="px-4 py-3">Valid</th>
                <th className="px-4 py-3">Last emailed</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono text-neutral-800">{c.card_number}</td>
                  <td className="px-4 py-3">
                    <Badge tone={c.card_type === 'student' ? 'blue' : c.card_type === 'coordinator' ? 'amber' : 'green'}>
                      {TYPE_LABEL[c.card_type] ?? c.card_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{c.student?.full_name}</div>
                    <div className="text-xs text-neutral-500">{c.student?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {c.course?.title ?? c.workshop_name ?? <Badge tone="neutral">General</Badge>}
                    {c.workshop_location && <div className="text-xs text-neutral-400">{c.workshop_location}</div>}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {c.valid_from ? new Date(c.valid_from).toLocaleDateString() : '—'}
                    {' – '}
                    {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{c.last_emailed_at ? new Date(c.last_emailed_at).toLocaleDateString() : 'never'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => download(c.pdf_path)}>
                        Download
                      </Button>
                      {writable && (
                        <>
                          <Button variant="ghost" onClick={() => regenerate(c)} title="Open a form to change the type, workshop or dates before rebuilding this card">
                            Regenerate
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => resend(c)}
                            loading={resendingId === c.id}
                            title="Rebuilds this card from its current details (same type/workshop/dates) and re-sends it — always uses the latest template"
                          >
                            <Send size={13} /> Resend
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate an ID card" wide>
        <div className="space-y-4">
          <Field label="Person">
            <Select value={draft.student_id} onChange={(e) => set('student_id', e.target.value)}>
              <option value="">Choose an account…</option>
              {q.data?.accounts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} — {s.email} ({s.role}
                  {s.status !== 'active' ? `, ${s.status}` : ''})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Preset" hint="Fills in the type, workshop and validity below — pick one and just generate.">
            <Select value={draft.preset_id} onChange={(e) => applyPreset(e.target.value)}>
              <option value="">No preset — set fields manually</option>
              {q.data?.presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({TYPE_LABEL[p.card_type as CardType] ?? p.card_type})
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Card type">
              <Select value={draft.card_type} onChange={(e) => set('card_type', e.target.value as CardType)}>
                {CARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            {draft.card_type === 'student' && (
              <Field label="Course" hint="Shown on the card front">
                <Select value={draft.course_id} onChange={(e) => set('course_id', e.target.value)}>
                  <option value="">General student</option>
                  {q.data?.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Workshop name">
              <TextInput value={draft.workshop_name} onChange={(e) => set('workshop_name', e.target.value)} placeholder="FPV Drones Workshop" />
            </Field>
            <Field label="Workshop location">
              <TextInput value={draft.workshop_location} onChange={(e) => set('workshop_location', e.target.value)} placeholder="Visakhapatnam" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Valid from">
              <TextInput type="date" value={draft.valid_from} onChange={(e) => set('valid_from', e.target.value)} />
            </Field>
            <Field label="Valid until (expiry)">
              <TextInput type="date" value={draft.valid_until} onChange={(e) => set('valid_until', e.target.value)} />
            </Field>
            <Field label="Fee paid" hint="Auto-filled from their registration if found">
              <TextInput value={draft.fee_paid} onChange={(e) => set('fee_paid', e.target.value)} placeholder="₹2,500 · Paid" />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button onClick={generate} loading={generating} disabled={!draft.student_id}>
              Generate &amp; email
            </Button>
          </div>
        </div>
      </Modal>

      {writable && <PresetsModal open={showPresets} onClose={() => setShowPresets(false)} presets={q.data?.presets ?? []} onChanged={q.refetch} />}
    </div>
  );
}

const emptyPresetDraft = () => ({
  name: '',
  card_type: 'student' as CardType,
  workshop_name: '',
  workshop_location: '',
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })(),
});

function PresetsModal({ open, onClose, presets, onChanged }: { open: boolean; onClose: () => void; presets: Preset[]; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(emptyPresetDraft());
  const set = <K extends keyof ReturnType<typeof emptyPresetDraft>>(k: K, v: ReturnType<typeof emptyPresetDraft>[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('id_card_presets').insert({
      name: draft.name.trim(),
      card_type: draft.card_type,
      workshop_name: draft.workshop_name || null,
      workshop_location: draft.workshop_location || null,
      valid_from: draft.valid_from || null,
      valid_until: draft.valid_until || null,
    });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Preset saved');
    setDraft(emptyPresetDraft());
    onChanged();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('id_card_presets').delete().eq('id', id);
    if (error) return toast(error.message, 'error');
    onChanged();
  };

  return (
    <Modal open={open} onClose={onClose} title="ID card presets" wide>
      <div className="space-y-5">
        <p className="text-sm text-neutral-500">
          A preset bundles a workshop's name, location and validity window under one name — pick it once when generating a
          card instead of typing the same details for every person in that batch.
        </p>

        {!!presets.length && (
          <div className="space-y-2">
            {presets.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/40 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-neutral-900">{p.name}</span>{' '}
                  <span className="text-xs text-neutral-500">
                    ({TYPE_LABEL[p.card_type as CardType] ?? p.card_type}
                    {p.workshop_location ? ` · ${p.workshop_location}` : ''})
                  </span>
                </div>
                <Button variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-white/60 pt-4">
          <div className="mb-3 text-sm font-medium text-neutral-700">New preset</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <TextInput value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="FPV Workshop — Jan 2026" />
            </Field>
            <Field label="Card type">
              <Select value={draft.card_type} onChange={(e) => set('card_type', e.target.value as CardType)}>
                {CARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Workshop name">
              <TextInput value={draft.workshop_name} onChange={(e) => set('workshop_name', e.target.value)} />
            </Field>
            <Field label="Workshop location">
              <TextInput value={draft.workshop_location} onChange={(e) => set('workshop_location', e.target.value)} />
            </Field>
            <Field label="Valid from">
              <TextInput type="date" value={draft.valid_from} onChange={(e) => set('valid_from', e.target.value)} />
            </Field>
            <Field label="Valid until">
              <TextInput type="date" value={draft.valid_until} onChange={(e) => set('valid_until', e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={save} loading={busy} disabled={!draft.name.trim()}>
              Save preset
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
