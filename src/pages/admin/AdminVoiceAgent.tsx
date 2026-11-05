import { useMemo, useState } from 'react';
import { Bot, Download, Flame, Globe, MessageCircle, Mic, Phone, PhoneCall, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { downloadCsv } from '../../lib/csv';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

type Status = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';
type Channel = 'web' | 'phone';
type Tone = 'blue' | 'amber' | 'green' | 'red' | 'neutral';

interface Line {
  role: 'user' | 'assistant';
  text: string;
}
interface Conversation {
  id: string;
  created_at: string;
  channel: Channel;
  call_id: string;
  duration_seconds: number | null;
  language: string;
  lead_name: string;
  phone: string;
  city: string;
  institution: string;
  audience_type: string;
  interest_level: string;
  program: string;
  next_step: string;
  callback_time: string;
  summary: string;
  whatsapp_offered: boolean;
  source_page: string;
  voice: string;
  transcript: Line[];
  status: Status;
  assigned_to: string | null;
  notes: string;
}
interface Staff {
  id: string;
  full_name: string;
}

const STATUSES: { key: Status; label: string; tone: Tone }[] = [
  { key: 'new', label: 'New', tone: 'blue' },
  { key: 'contacted', label: 'Contacted', tone: 'amber' },
  { key: 'qualified', label: 'Qualified', tone: 'amber' },
  { key: 'won', label: 'Won', tone: 'green' },
  { key: 'lost', label: 'Lost', tone: 'neutral' },
];
const INTEREST: Record<string, { label: string; tone: Tone }> = {
  hot: { label: 'Hot', tone: 'red' },
  warm: { label: 'Warm', tone: 'amber' },
  cold: { label: 'Cold', tone: 'blue' },
  not_interested: { label: 'Not interested', tone: 'neutral' },
};
const LANGUAGES: Record<string, string> = { te: 'Telugu', hi: 'Hindi', ta: 'Tamil', kn: 'Kannada', en: 'English' };
const NEXT_STEP: Record<string, string> = {
  enroll_whatsapp: 'Enroll on WhatsApp',
  book_demo: 'Book a demo',
  founder_meeting: 'Meeting with founder',
  send_whatsapp: 'Send details on WhatsApp',
  callback: 'Call back',
  none: 'No next step',
  do_not_call: 'Do not call',
};

const statusTone = (s: Status) => STATUSES.find((x) => x.key === s)?.tone ?? 'neutral';
const statusLabel = (s: Status) => STATUSES.find((x) => x.key === s)?.label ?? s;
const who = (c: Conversation) => c.lead_name || (c.channel === 'web' ? 'Website visitor' : c.phone || 'Unknown caller');
const minutes = (s: number | null) => (s == null ? '' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);
const whatsappTo = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`;

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Conversations held by the voice agent on the website and on phone calls, worked like enquiries. */
export function AdminVoiceAgent() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('voice-agent');
  const { profile } = useAuth();
  const canExport = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [status, setStatus] = useState<Status | 'all'>('all');
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [interest, setInterest] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Conversation | null>(null);

  const q = useQuery(
    () => unwrap(supabase.from('voice_agent_calls').select('*').order('created_at', { ascending: false }).limit(1000)) as Promise<Conversation[]>,
    [],
  );
  const staff = useQuery(
    () => unwrap(supabase.from('profiles').select('id, full_name').in('role', ['admin', 'super_admin', 'coordinator', 'instructor']).eq('status', 'active').order('full_name')) as Promise<Staff[]>,
    [],
  );
  const settings = useQuery(
    () => unwrap(supabase.from('voice_agent_settings').select('founder_voice_enabled').eq('id', 1).maybeSingle()) as Promise<{ founder_voice_enabled: boolean } | null>,
    [],
  );
  const [savingVoice, setSavingVoice] = useState(false);
  const toggleFounderVoice = async () => {
    const next = !(settings.data?.founder_voice_enabled ?? false);
    setSavingVoice(true);
    const { error } = await supabase.from('voice_agent_settings').update({ founder_voice_enabled: next, updated_by: profile?.id ?? null }).eq('id', 1);
    setSavingVoice(false);
    if (error) return toast(error.message, 'error');
    toast(next ? "Yogesh's voice is switched on" : "Yogesh's voice is switched off — everyone hears Priya");
    settings.refetch();
  };
  const staffName = useMemo(() => new Map((staff.data ?? []).map((s) => [s.id, s.full_name] as const)), [staff.data]);

  const all = q.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const s of STATUSES) c[s.key] = all.filter((e) => e.status === s.key).length;
    return c;
  }, [all]);
  const stats = useMemo(
    () => ({
      web: all.filter((c) => c.channel === 'web').length,
      phone: all.filter((c) => c.channel === 'phone').length,
      hot: all.filter((c) => c.interest_level === 'hot' || c.interest_level === 'warm').length,
      whatsapp: all.filter((c) => c.whatsapp_offered).length,
    }),
    [all],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (channel === 'all' || c.channel === channel) &&
        (interest === 'all' || c.interest_level === interest) &&
        (!needle || [c.lead_name, c.phone, c.city, c.institution, c.program, c.summary].some((v) => (v ?? '').toLowerCase().includes(needle))),
    );
  }, [all, status, channel, interest, search]);

  const exportCsv = () => {
    const headers = ['When', 'Channel', 'Language', 'Name', 'Phone', 'City', 'College / organisation', 'Who', 'Interest', 'Program', 'Next step', 'Callback', 'WhatsApp offered', 'Summary', 'Status', 'Assigned to', 'Notes', 'Duration'];
    const body = rows.map((c) => [
      new Date(c.created_at).toLocaleString('en-GB'),
      c.channel === 'web' ? 'Website' : 'Phone',
      LANGUAGES[c.language] ?? c.language,
      c.lead_name,
      c.phone,
      c.city,
      c.institution,
      c.audience_type,
      INTEREST[c.interest_level]?.label ?? '',
      c.program,
      NEXT_STEP[c.next_step] ?? c.next_step,
      c.callback_time,
      c.whatsapp_offered ? 'Yes' : 'No',
      c.summary,
      statusLabel(c.status),
      c.assigned_to ? staffName.get(c.assigned_to) ?? '' : '',
      c.notes,
      minutes(c.duration_seconds),
    ]);
    downloadCsv(`voice-agent-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
    toast(`Exported ${rows.length} conversation${rows.length === 1 ? '' : 's'}`);
  };

  if (!q.data) return q.error ? <EmptyState icon={<Bot size={22} />} title="Could not load conversations" description={q.error} /> : <Spinner />;

  return (
    <div>
      <PageHeader
        title="Voice Agent"
        subtitle="Conversations with Priya, the AI assistant on the website and on outbound calls, newest first"
        actions={
          canExport && (
            <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
              <Download size={15} /> Export CSV
            </Button>
          )
        }
      />

      <GlassCard className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900">
            <Mic size={15} /> Yogesh's voice (draft)
            <Badge tone={settings.data?.founder_voice_enabled ? 'green' : 'neutral'}>{settings.data?.founder_voice_enabled ? 'On' : 'Off'}</Badge>
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            When on, website visitors can choose Priya or Yogesh's cloned voice. When off, everyone hears Priya. Takes effect within 30 seconds.
            It also needs FOUNDER_VOICE_ENABLED=1 on the voice agent server while the voice is a draft.
          </p>
        </div>
        {writable && (
          <Button variant="secondary" onClick={toggleFounderVoice} loading={savingVoice} disabled={settings.data === undefined}>
            {settings.data?.founder_voice_enabled ? 'Switch off' : 'Switch on'}
          </Button>
        )}
      </GlassCard>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Stat icon={<Globe size={16} />} label="Website conversations" value={stats.web} />
        <Stat icon={<PhoneCall size={16} />} label="Phone calls" value={stats.phone} />
        <Stat icon={<Flame size={16} />} label="Hot or warm leads" value={stats.hot} />
        <Stat icon={<MessageCircle size={16} />} label="Sent to WhatsApp" value={stats.whatsapp} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([{ key: 'all', label: 'All' }, ...STATUSES] as { key: Status | 'all'; label: string }[]).map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${status === s.key ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-700 hover:bg-white'}`}
          >
            {s.label} <span className="opacity-60">{counts[s.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_180px]">
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, city, college, program or summary" />
        <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel | 'all')}>
          <option value="all">Website and phone</option>
          <option value="web">Website only</option>
          <option value="phone">Phone only</option>
        </Select>
        <Select value={interest} onChange={(e) => setInterest(e.target.value)}>
          <option value="all">Any interest</option>
          {Object.entries(INTEREST).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>

      {!rows.length ? (
        <EmptyState
          icon={<Bot size={22} />}
          title={all.length ? 'No conversations match' : 'No conversations yet'}
          description={
            all.length
              ? 'Try another status, channel, interest or search.'
              : 'When a visitor talks to the assistant on the website, or the agent finishes a phone call, the conversation appears here.'
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <GlassCard key={c.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(c)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-900">{who(c)}</span>
                    <Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge>
                    {INTEREST[c.interest_level] && <Badge tone={INTEREST[c.interest_level].tone}>{INTEREST[c.interest_level].label}</Badge>}
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                      {c.channel === 'web' ? <Globe size={14} /> : <PhoneCall size={14} />}
                      {c.channel === 'web' ? 'Website' : 'Phone'} · {LANGUAGES[c.language] ?? c.language}
                      {c.voice === 'founder' ? " · Yogesh's voice" : ''}
                      {c.duration_seconds != null && ` · ${minutes(c.duration_seconds)}`}
                    </span>
                    {c.whatsapp_offered && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <MessageCircle size={14} /> WhatsApp
                      </span>
                    )}
                    <span className="text-xs text-neutral-400">{ago(c.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {[c.program, NEXT_STEP[c.next_step], c.institution, c.city].filter(Boolean).join(' · ') || 'No summary saved'}
                    {c.assigned_to && staffName.get(c.assigned_to) ? ` · Assigned to ${staffName.get(c.assigned_to)}` : ''}
                  </p>
                  {c.summary && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{c.summary}</p>}
                </button>
                {c.phone && (
                  <div className="flex shrink-0 items-center gap-1">
                    <a href={`tel:${c.phone}`} title={`Call ${c.phone}`} className="rounded-full p-2 text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800">
                      <Phone size={16} />
                    </a>
                    <a href={whatsappTo(c.phone)} target="_blank" rel="noreferrer" title={`WhatsApp ${c.phone}`} className="rounded-full p-2 text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800">
                      <MessageCircle size={16} />
                    </a>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {open && (
        <ConversationModal
          conversation={open}
          staff={staff.data ?? []}
          writable={writable}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            q.refetch();
          }}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <GlassCard className="p-4">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
        {icon} {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </GlassCard>
  );
}

function ConversationModal({ conversation: c, staff, writable, onClose, onSaved }: { conversation: Conversation; staff: Staff[]; writable: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>(c.status);
  const [assignedTo, setAssignedTo] = useState(c.assigned_to ?? '');
  const [notes, setNotes] = useState(c.notes);
  const [busy, setBusy] = useState(false);
  const transcript = Array.isArray(c.transcript) ? c.transcript : [];

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('voice_agent_calls').update({ status, assigned_to: assignedTo || null, notes: notes.trim() }).eq('id', c.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Conversation updated');
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Delete this conversation with ${who(c)}? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.from('voice_agent_calls').delete().eq('id', c.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Conversation deleted');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={who(c)} wide>
      <div className="space-y-4">
        <div className="grid gap-3 rounded-2xl border border-white/60 bg-white/50 p-4 text-sm sm:grid-cols-3">
          <Detail label="Channel" value={c.channel === 'web' ? `Website${c.source_page ? ` (${c.source_page})` : ''}` : 'Outbound phone call'} />
          <Detail label="When" value={`${new Date(c.created_at).toLocaleString('en-GB')}${c.duration_seconds != null ? ` · ${minutes(c.duration_seconds)}` : ''}`} />
          <Detail label="Language" value={`${LANGUAGES[c.language] ?? c.language}${c.voice ? ` · ${c.voice === 'founder' ? "Yogesh's voice" : 'Priya'}` : ''}`} />
          <Detail label="Phone" value={c.phone} href={c.phone ? `tel:${c.phone}` : undefined} />
          <Detail label="City" value={c.city} />
          <Detail label="College / organisation" value={c.institution} />
          <Detail label="Who" value={c.audience_type} />
          <Detail label="Interest" value={INTEREST[c.interest_level]?.label ?? ''} />
          <Detail label="Program" value={c.program} />
          <Detail label="Next step" value={NEXT_STEP[c.next_step] ?? c.next_step} />
          <Detail label="Call back" value={c.callback_time} />
          <Detail label="Sent to WhatsApp" value={c.whatsapp_offered ? 'Yes — the visitor was shown the WhatsApp button' : 'No'} />
        </div>

        {c.summary && (
          <div className="rounded-2xl border border-white/60 bg-white/50 p-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Agent's summary</p>
            <p className="text-sm leading-relaxed text-neutral-700">{c.summary}</p>
          </div>
        )}

        <div className="rounded-2xl border border-white/60 bg-white/50 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Conversation</p>
          {transcript.length ? (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {transcript.map((l, i) => (
                <div key={i} className={`flex ${l.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <p className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${l.role === 'user' ? 'bg-[#1a1a1a] text-white' : 'bg-white text-neutral-800'}`}>
                    {l.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">No words were exchanged.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Status)} disabled={!writable}>
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned to">
            <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} disabled={!writable}>
              <option value="">Nobody yet</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notes" hint="Follow-up calls, WhatsApp replies, what was agreed. Only staff see this.">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={4000} disabled={!writable} />
        </Field>

        <div className="flex justify-between gap-2">
          <div className="flex gap-2">
            {writable && (
              <Button variant="secondary" onClick={remove} disabled={busy}>
                <Trash2 size={15} /> Delete
              </Button>
            )}
            {c.phone && (
              <a href={whatsappTo(c.phone)} target="_blank" rel="noreferrer">
                <Button variant="secondary" disabled={busy}>
                  <MessageCircle size={15} /> WhatsApp them
                </Button>
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {writable ? 'Cancel' : 'Close'}
            </Button>
            {writable && (
              <Button onClick={save} loading={busy}>
                Save
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Detail({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      {value ? (
        href ? (
          <a href={href} className="text-neutral-800 underline-offset-2 hover:underline">
            {value}
          </a>
        ) : (
          <p className="text-neutral-800">{value}</p>
        )
      ) : (
        <p className="text-neutral-400">Not given</p>
      )}
    </div>
  );
}
