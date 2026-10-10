import { useMemo, useState } from 'react';
import { Building2, Download, GraduationCap, Inbox, Mail, MessageCircle, Phone, PlayCircle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { downloadCsv } from '../../lib/csv';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

type Status = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';
type Kind = 'student' | 'college' | 'demo' | 'general';

interface Enquiry {
  id: string;
  created_at: string;
  kind: Kind;
  full_name: string;
  email: string | null;
  phone: string | null;
  organisation: string;
  interest: string;
  message: string;
  source_page: string;
  status: Status;
  assigned_to: string | null;
  notes: string;
}
interface Staff {
  id: string;
  full_name: string;
}

const STATUSES: { key: Status; label: string; tone: 'blue' | 'amber' | 'green' | 'red' | 'neutral' }[] = [
  { key: 'new', label: 'New', tone: 'blue' },
  { key: 'contacted', label: 'Contacted', tone: 'amber' },
  { key: 'qualified', label: 'Qualified', tone: 'amber' },
  { key: 'won', label: 'Won', tone: 'green' },
  { key: 'lost', label: 'Lost', tone: 'neutral' },
];
const KINDS: Record<Kind, { label: string; icon: React.ReactNode }> = {
  student: { label: 'Student / parent', icon: <GraduationCap size={14} /> },
  college: { label: 'College / university', icon: <Building2 size={14} /> },
  demo: { label: 'Free demo', icon: <PlayCircle size={14} /> },
  general: { label: 'General', icon: <MessageCircle size={14} /> },
};
const statusTone = (s: Status) => STATUSES.find((x) => x.key === s)?.tone ?? 'neutral';
const statusLabel = (s: Status) => STATUSES.find((x) => x.key === s)?.label ?? s;

/** "5 min ago", "3 h ago", "12 Oct" so the newest leads read at a glance. */
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function AdminEnquiries() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('enquiries');
  const { profile } = useAuth();
  // The export carries phone numbers and emails, so it is limited to admins.
  const canExport = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [status, setStatus] = useState<Status | 'all'>('all');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Enquiry | null>(null);

  const q = useQuery(
    () => unwrap(supabase.from('site_enquiries').select('*').order('created_at', { ascending: false }).limit(1000)) as Promise<Enquiry[]>,
    [],
  );
  const staff = useQuery(
    () => unwrap(supabase.from('profiles').select('id, full_name').in('role', ['admin', 'super_admin', 'coordinator', 'instructor']).eq('status', 'active').order('full_name')) as Promise<Staff[]>,
    [],
  );
  const staffName = useMemo(() => new Map((staff.data ?? []).map((s) => [s.id, s.full_name] as const)), [staff.data]);

  const all = q.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const s of STATUSES) c[s.key] = all.filter((e) => e.status === s.key).length;
    return c;
  }, [all]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter(
      (e) =>
        (status === 'all' || e.status === status) &&
        (kind === 'all' || e.kind === kind) &&
        (!needle || [e.full_name, e.email, e.phone, e.organisation, e.interest, e.message].some((v) => (v ?? '').toLowerCase().includes(needle))),
    );
  }, [all, status, kind, search]);

  const exportCsv = () => {
    const headers = ['Received', 'Type', 'Name', 'Phone', 'Email', 'College / organisation', 'Interested in', 'Message', 'Status', 'Assigned to', 'Notes', 'Page'];
    const body = rows.map((e) => [
      new Date(e.created_at).toLocaleString('en-GB'),
      KINDS[e.kind].label,
      e.full_name,
      e.phone ?? '',
      e.email ?? '',
      e.organisation,
      e.interest,
      e.message,
      statusLabel(e.status),
      e.assigned_to ? staffName.get(e.assigned_to) ?? '' : '',
      e.notes,
      e.source_page,
    ]);
    downloadCsv(`enquiries-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
    toast(`Exported ${rows.length} enquir${rows.length === 1 ? 'y' : 'ies'}`);
  };

  if (!q.data) return q.error ? <EmptyState icon={<Inbox size={22} />} title="Could not load enquiries" description={q.error} /> : <Spinner />;

  return (
    <div>
      <PageHeader
        title="Enquiries"
        subtitle={counts.new ? `${counts.new} new from the website, newest first` : 'Students, parents and colleges who wrote to us from the website'}
        actions={
          canExport && (
            <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
              <Download size={15} /> Export CSV
            </Button>
          )
        }
      />

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

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]">
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email, college or message" />
        <Select value={kind} onChange={(e) => setKind(e.target.value as Kind | 'all')}>
          <option value="all">All types</option>
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <option key={k} value={k}>
              {KINDS[k].label}
            </option>
          ))}
        </Select>
      </div>

      {!rows.length ? (
        <EmptyState
          icon={<Inbox size={22} />}
          title={all.length ? 'No enquiries match' : 'No enquiries yet'}
          description={all.length ? 'Try another status, type or search.' : 'When someone fills in the enquiry form on the website, it appears here and admins are notified.'}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((e) => (
            <GlassCard key={e.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(e)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-900">{e.full_name}</span>
                    <Badge tone={statusTone(e.status)}>{statusLabel(e.status)}</Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                      {KINDS[e.kind].icon} {KINDS[e.kind].label}
                    </span>
                    <span className="text-xs text-neutral-400">{ago(e.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {[e.organisation, e.interest].filter(Boolean).join(' · ') || 'No details given'}
                    {e.assigned_to && staffName.get(e.assigned_to) ? ` · Assigned to ${staffName.get(e.assigned_to)}` : ''}
                  </p>
                  {e.message && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{e.message}</p>}
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {e.phone && (
                    <a href={`tel:${e.phone}`} title={`Call ${e.phone}`} className="rounded-full p-2 text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800">
                      <Phone size={16} />
                    </a>
                  )}
                  {e.email && (
                    <a href={`mailto:${e.email}`} title={`Email ${e.email}`} className="rounded-full p-2 text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800">
                      <Mail size={16} />
                    </a>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {open && (
        <EnquiryModal
          enquiry={open}
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

function EnquiryModal({ enquiry, staff, writable, onClose, onSaved }: { enquiry: Enquiry; staff: Staff[]; writable: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>(enquiry.status);
  const [assignedTo, setAssignedTo] = useState(enquiry.assigned_to ?? '');
  const [notes, setNotes] = useState(enquiry.notes);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('site_enquiries')
      .update({ status, assigned_to: assignedTo || null, notes: notes.trim() })
      .eq('id', enquiry.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Enquiry updated');
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Delete the enquiry from ${enquiry.full_name}? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.from('site_enquiries').delete().eq('id', enquiry.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Enquiry deleted');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={enquiry.full_name} wide>
      <div className="space-y-4">
        <div className="grid gap-3 rounded-2xl border border-white/60 bg-white/50 p-4 text-sm sm:grid-cols-2">
          <Detail label="Type" value={KINDS[enquiry.kind].label} />
          <Detail label="Received" value={new Date(enquiry.created_at).toLocaleString('en-GB')} />
          <Detail label="Phone" value={enquiry.phone} href={enquiry.phone ? `tel:${enquiry.phone}` : undefined} />
          <Detail label="Email" value={enquiry.email} href={enquiry.email ? `mailto:${enquiry.email}` : undefined} />
          <Detail label="College / organisation" value={enquiry.organisation} />
          <Detail label="Interested in" value={enquiry.interest} />
          {enquiry.source_page && <Detail label="Sent from" value={enquiry.source_page} />}
        </div>

        {enquiry.message && (
          <div className="rounded-2xl border border-white/60 bg-white/50 p-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Message</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{enquiry.message}</p>
          </div>
        )}

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

        <Field label="Notes" hint="Calls made, what was agreed, next step. Only staff see this.">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={4000} disabled={!writable} />
        </Field>

        <div className="flex justify-between gap-2">
          <div>
            {writable && (
              <Button variant="secondary" onClick={remove} disabled={busy}>
                <Trash2 size={15} /> Delete
              </Button>
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
