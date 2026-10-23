import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, FilePlus2, Link2, Mail, MessageCircle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { fmtDate } from '../../lib/quotations';
import {
  REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, moduleLine, parseAnswers, requestUrl,
  type QuoteRequest, type RequestStatus,
} from '../../lib/quoteRequests';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Spinner, TextInput, useToast } from '../../components/ui/kit';

const ago = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Links the admin sends to clients, and what each client answered. The answers become a quotation with one click. */
export function QuoteRequests() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('quotations');
  const [creating, setCreating] = useState<{ client_name: string; organisation: string; client_email: string; client_phone: string; enquiry_id: string | null } | null>(null);
  const [viewing, setViewing] = useState<QuoteRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery(() => unwrap(supabase.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(300)) as Promise<QuoteRequest[]>, []);
  const quoted = useQuery(
    async () => {
      const rows = (await unwrap(supabase.from('quotations').select('id, quote_no, request_id').not('request_id', 'is', null))) as { id: string; quote_no: string; request_id: string }[];
      return new Map(rows.map((r) => [r.request_id, r] as const));
    },
    [],
  );

  // Arriving from an enquiry ("Send requirement form"): open the new-link window with the lead's details.
  const enquiryId = params.get('enquiry');
  useEffect(() => {
    if (!enquiryId || !writable) return;
    let live = true;
    void (async () => {
      const { data } = await supabase.from('site_enquiries').select('id, full_name, email, phone, organisation').eq('id', enquiryId).maybeSingle();
      if (live && data) setCreating({ client_name: data.full_name, organisation: data.organisation ?? '', client_email: data.email ?? '', client_phone: data.phone ?? '', enquiry_id: data.id });
      if (live) setParams({}, { replace: true });
    })();
    return () => {
      live = false;
    };
  }, [enquiryId, writable, setParams]);

  const rows = q.data ?? [];

  const copyLink = async (r: QuoteRequest) => {
    const ok = await copy(requestUrl(r.token));
    toast(ok ? 'Link copied' : 'Could not copy. Select the link and copy it by hand.', ok ? 'success' : 'error');
  };
  const setStatus = async (r: QuoteRequest, status: RequestStatus) => {
    setBusy(r.id);
    const { error } = await supabase.from('quote_requests').update({ status }).eq('id', r.id);
    setBusy(null);
    if (error) return toast(error.message, 'error');
    q.refetch();
  };
  const remove = async (r: QuoteRequest) => {
    if (!confirm(`Delete the link for ${r.organisation || r.client_name}? The client will no longer be able to open it.`)) return;
    setBusy(r.id);
    const { error } = await supabase.from('quote_requests').delete().eq('id', r.id);
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast('Link deleted');
    q.refetch();
  };

  if (!q.data) return q.error ? <EmptyState icon={<Link2 size={22} />} title="Could not load the forms" description={q.error} /> : <Spinner />;

  return (
    <div>
      <Link to="/admin/quotations" className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"><ArrowLeft size={14} /> Quotations</Link>
      <PageHeader
        title="Requirement forms"
        subtitle="Send a client a link. They choose what they expect (simulation, piloting, theory, PID, PCB and more), and you turn their answers into a quotation."
        actions={writable && <Button onClick={() => setCreating({ client_name: '', organisation: '', client_email: '', client_phone: '', enquiry_id: null })}><Link2 size={15} /> New link</Button>}
      />

      {!rows.length ? (
        <EmptyState icon={<Link2 size={22} />} title="No links yet" description={writable ? 'Create a link for a client, copy it, and send it by email or WhatsApp.' : undefined} />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const expired = new Date(r.expires_at).getTime() < Date.now() && r.status !== 'quoted';
            const link = requestUrl(r.token);
            const made = quoted.data?.get(r.id);
            const text = `Hello ${r.client_name.split(' ')[0]}, please tell us what you would like us to cover in the FPV training so we can prepare your quotation: ${link}`;
            return (
              <GlassCard key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-900">{r.organisation || r.client_name}</span>
                      <Badge tone={expired ? 'red' : REQUEST_STATUS_TONE[r.status as RequestStatus]}>{expired ? 'Expired' : REQUEST_STATUS_LABEL[r.status as RequestStatus]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{r.client_name}{r.client_email ? ` · ${r.client_email}` : ''}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Created {ago(r.created_at)} · {r.submitted_at ? `answered ${ago(r.submitted_at)}${r.submit_count > 1 ? ` (${r.submit_count} times)` : ''}` : `link valid until ${ago(r.expires_at)}`}
                    </p>
                    {r.status !== 'quoted' && !expired && r.status !== 'closed' && (
                      <p className="mt-2 break-all rounded-xl bg-white/70 px-3 py-1.5 font-mono text-xs text-neutral-600">{link}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {r.status !== 'quoted' && !expired && r.status !== 'closed' && (
                      <>
                        <Button variant="ghost" title="Copy the link" onClick={() => void copyLink(r)}><Copy size={15} /></Button>
                        <a title="Send by email" href={`mailto:${r.client_email ?? ''}?subject=${encodeURIComponent('Your FPV training quotation: tell us what you need')}&body=${encodeURIComponent(text)}`} className="rounded-full p-2 text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800"><Mail size={15} /></a>
                        <a title="Send on WhatsApp" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${r.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`} className="rounded-full p-2 text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800"><MessageCircle size={15} /></a>
                        <a title="Open the form as the client sees it" target="_blank" rel="noopener noreferrer" href={link} className="rounded-full p-2 text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800"><ExternalLink size={15} /></a>
                      </>
                    )}
                    {r.answers != null && <Button variant="secondary" onClick={() => setViewing(r)}>View answers</Button>}
                    {made && <Button variant="secondary" onClick={() => navigate(`/admin/quotations/${made.id}`)}>{made.quote_no}</Button>}
                    {writable && (r.status === 'submitted' || (r.status === 'quoted' && !made)) && (
                      <Button onClick={() => navigate(`/admin/quotations/new?request=${r.id}`)}><FilePlus2 size={15} /> Generate quotation</Button>
                    )}
                    {writable && r.status === 'open' && !expired && <Button variant="ghost" disabled={busy === r.id} onClick={() => void setStatus(r, 'closed')}>Close</Button>}
                    {writable && (r.status === 'open' || r.status === 'closed') && <Button variant="ghost" title="Delete" disabled={busy === r.id} onClick={() => void remove(r)}><Trash2 size={15} /></Button>}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {creating && <NewLink initial={creating} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); q.refetch(); }} />}
      {viewing && <Answers row={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function NewLink({ initial, onClose, onCreated }: { initial: { client_name: string; organisation: string; client_email: string; client_phone: string; enquiry_id: string | null }; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ ...initial, days: '30' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!f.client_name.trim()) return setError('Enter the client’s name.');
    if (f.client_email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.client_email.trim())) return setError('The email does not look right.');
    const days = Math.min(Math.max(Number(f.days) || 30, 1), 180);
    setBusy(true);
    const { data, error: e } = await supabase
      .from('quote_requests')
      .insert({
        client_name: f.client_name.trim(), organisation: f.organisation.trim(), client_email: f.client_email.trim() || null, client_phone: f.client_phone.trim(),
        enquiry_id: f.enquiry_id, expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      })
      .select('token')
      .single();
    setBusy(false);
    if (e || !data) return setError(e?.message ?? 'Could not create the link');
    const ok = await copy(requestUrl((data as { token: string }).token));
    toast(ok ? 'Link created and copied. Send it to the client.' : 'Link created. Copy it from the list.');
    onCreated();
  };

  return (
    <Modal open onClose={onClose} title="New requirement link">
      <div className="space-y-4">
        <Field label="Client name" required><TextInput value={f.client_name} maxLength={120} onChange={(e) => { setError(null); setF({ ...f, client_name: e.target.value }); }} /></Field>
        <Field label="College, club or company"><TextInput value={f.organisation} maxLength={200} onChange={(e) => setF({ ...f, organisation: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" hint="Used to send the link from your mail app."><TextInput type="email" value={f.client_email} maxLength={200} onChange={(e) => setF({ ...f, client_email: e.target.value })} /></Field>
          <Field label="Phone" hint="Used for WhatsApp."><TextInput value={f.client_phone} maxLength={30} onChange={(e) => setF({ ...f, client_phone: e.target.value })} /></Field>
        </div>
        <Field label="Link works for (days)" hint="After this the client sees that the link has expired."><TextInput inputMode="numeric" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value.replace(/\D/g, '') })} /></Field>
        <p className="text-xs text-neutral-500">The client can answer without signing in. Only they and your team can see what they entered.</p>
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void create()} loading={busy}>Create and copy link</Button>
        </div>
      </div>
    </Modal>
  );
}

function Answers({ row, onClose }: { row: QuoteRequest; onClose: () => void }) {
  const a = parseAnswers(row.answers);
  return (
    <Modal open onClose={onClose} title={`${row.organisation || row.client_name}: what they asked for`} wide>
      {!a ? (
        <p className="text-sm text-neutral-600">No answers yet.</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 rounded-2xl border border-white/60 bg-white/50 p-4 sm:grid-cols-2">
            <Item k="Contact" v={`${a.contact.name}${a.contact.designation ? `, ${a.contact.designation}` : ''}`} />
            <Item k="Organisation" v={a.contact.organisation} />
            <Item k="Email" v={a.contact.email} />
            <Item k="Phone" v={a.contact.phone} />
            <Item k="Participants" v={`${a.event.participants} · ${a.event.audience}`} />
            <Item k="Experience" v={a.event.experience} />
            <Item k="Held" v={`${a.event.mode}${a.event.venue ? `, ${a.event.venue}` : ''}`} />
            <Item k="Preferred dates" v={[a.event.start && fmtDate(a.event.start), a.event.end && a.event.end !== a.event.start ? `to ${fmtDate(a.event.end)}` : '', a.event.flexible ? '(flexible)' : ''].filter(Boolean).join(' ') || 'Not given'} />
            <Item k="Certificates" v={a.event.certificates ? 'Wanted' : 'Not needed'} />
            <Item k="Budget" v={a.budget} />
          </div>
          <div>
            <p className="mb-2 font-medium text-neutral-900">Covering</p>
            <ul className="space-y-2">
              {a.modules.map((m) => (
                <li key={m.key} className="rounded-2xl border border-white/60 bg-white/50 p-3">
                  <p className="font-medium text-neutral-900">{m.title}</p>
                  <p className="text-neutral-600">{moduleLine(m).replace(`${m.title}: `, '')}</p>
                  {m.options.map((o) => <p key={o.key} className="text-xs text-neutral-500">{o.label}: {o.values.join(', ')}</p>)}
                </li>
              ))}
            </ul>
          </div>
          {a.notes && <div className="rounded-2xl border border-white/60 bg-white/50 p-4"><p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Their notes</p><p className="whitespace-pre-wrap text-neutral-700">{a.notes}</p></div>}
        </div>
      )}
    </Modal>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{k}</p>
      <p className="text-neutral-800">{v || 'Not given'}</p>
    </div>
  );
}
