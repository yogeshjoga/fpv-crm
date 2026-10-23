import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery } from '../../lib/useQuery';
import { fetchOrgBrand } from '../../lib/useOrgBrand';
import { DEFAULT_DESIGNATION } from '../../lib/offers';
import type { Json } from '../../lib/database.types';
import {
  DEFAULT_INCLUSIONS, DEFAULT_PAYMENT, DEFAULT_TERMS, MODE_LABEL, PROGRAMME_LABEL, TOPIC_SUGGESTIONS,
  STATUS_LABEL, amountInWords, calcTotals, fmtDate, inr, isoDate, parseItems, parseList,
  type DeliveryMode, type ProgrammeType, type Quotation, type QuoteStatus,
} from '../../lib/quotations';
import { downloadQuotationPdf, previewQuotationPdf } from '../../lib/quotationPdf';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Field, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

interface Line {
  description: string;
  qty: string;
  unit: string;
  rate: string;
  /** Quantity follows the number of participants. */
  perStudent?: boolean;
}
interface Form {
  client_name: string; client_designation: string; organisation: string; client_email: string; client_phone: string; client_address: string;
  title: string; programme_type: ProgrammeType; participants: string; duration_days: string; hours_per_day: string;
  mode: DeliveryMode; venue: string; proposed_start: string; proposed_end: string; dates_note: string;
  issued_on: string; valid_until: string;
  topics: string[]; lines: Line[]; discount: string; gst_percent: string; gst_note: string;
  inclusions: string[]; terms: string; payment_terms: string; notes: string;
  prepared_by: string; prepared_phone: string; signatory_name: string; signatory_designation: string;
}

const numOrNull = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s));
const clean = (s: string) => s.trim();

/** A quotation as the PDF reads it, built from the form so it can be previewed before it is saved. */
function toQuotation(f: Form, saved: Quotation | null): Quotation {
  const items = f.lines.filter((l) => clean(l.description)).map((l) => ({ description: clean(l.description), qty: Number(l.qty) || 0, unit: clean(l.unit), rate: Number(l.rate) || 0 }));
  const t = calcTotals(items, Number(f.discount) || 0, Number(f.gst_percent) || 0);
  return {
    id: saved?.id ?? '', quote_no: saved?.quote_no ?? 'DRAFT', status: saved?.status ?? 'draft', enquiry_id: saved?.enquiry_id ?? null,
    client_name: clean(f.client_name), client_designation: clean(f.client_designation), organisation: clean(f.organisation),
    client_email: clean(f.client_email) || null, client_phone: clean(f.client_phone), client_address: clean(f.client_address),
    title: clean(f.title), programme_type: f.programme_type, topics: f.topics.map(clean).filter(Boolean) as unknown as Json,
    participants: Number(f.participants) || 0, duration_days: numOrNull(f.duration_days), hours_per_day: numOrNull(f.hours_per_day),
    mode: f.mode, venue: clean(f.venue), proposed_start: f.proposed_start || null, proposed_end: f.proposed_end || null, dates_note: clean(f.dates_note),
    issued_on: f.issued_on, valid_until: f.valid_until, items: items as unknown as Json,
    discount_amount: Number(f.discount) || 0, gst_percent: Number(f.gst_percent) || 0, gst_note: clean(f.gst_note),
    subtotal: t.subtotal, gst_amount: t.gst, total: t.total,
    inclusions: f.inclusions.map(clean).filter(Boolean) as unknown as Json, terms: f.terms.trim(), payment_terms: f.payment_terms.trim(), notes: f.notes.trim(),
    prepared_by: clean(f.prepared_by), prepared_phone: clean(f.prepared_phone), signatory_name: clean(f.signatory_name), signatory_designation: clean(f.signatory_designation),
    sent_at: saved?.sent_at ?? null, responded_at: saved?.responded_at ?? null, created_by: saved?.created_by ?? null,
    created_at: saved?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

function fromQuotation(q: Quotation): Form {
  const items = parseItems(q.items);
  return {
    client_name: q.client_name, client_designation: q.client_designation, organisation: q.organisation, client_email: q.client_email ?? '', client_phone: q.client_phone, client_address: q.client_address,
    title: q.title, programme_type: q.programme_type as ProgrammeType, participants: String(q.participants), duration_days: q.duration_days === null ? '' : String(q.duration_days), hours_per_day: q.hours_per_day === null ? '' : String(q.hours_per_day),
    mode: q.mode as DeliveryMode, venue: q.venue, proposed_start: q.proposed_start ?? '', proposed_end: q.proposed_end ?? '', dates_note: q.dates_note,
    issued_on: q.issued_on, valid_until: q.valid_until,
    topics: parseList(q.topics),
    lines: items.map((i) => ({ description: i.description, qty: String(i.qty), unit: i.unit, rate: String(i.rate), perStudent: i.qty === q.participants && /student|participant|head/i.test(i.unit) })),
    discount: String(q.discount_amount), gst_percent: String(q.gst_percent), gst_note: q.gst_note,
    inclusions: parseList(q.inclusions), terms: q.terms, payment_terms: q.payment_terms, notes: q.notes,
    prepared_by: q.prepared_by, prepared_phone: q.prepared_phone, signatory_name: q.signatory_name, signatory_designation: q.signatory_designation,
  };
}

const blank = (): Form => ({
  client_name: '', client_designation: '', organisation: '', client_email: '', client_phone: '', client_address: '',
  title: '', programme_type: 'workshop', participants: '30', duration_days: '1', hours_per_day: '6',
  mode: 'onsite', venue: '', proposed_start: '', proposed_end: '', dates_note: '',
  issued_on: isoDate(0), valid_until: isoDate(15),
  topics: [], lines: [{ description: 'Workshop fee', qty: '30', unit: 'per student', rate: '', perStudent: true }], discount: '0', gst_percent: '0', gst_note: '',
  inclusions: [...DEFAULT_INCLUSIONS], terms: DEFAULT_TERMS, payment_terms: DEFAULT_PAYMENT, notes: '',
  prepared_by: '', prepared_phone: '', signatory_name: '', signatory_designation: DEFAULT_DESIGNATION,
});

const QUICK_LINES: { label: string; line: Line }[] = [
  { label: 'Travel', line: { description: 'Travel for the trainers', qty: '1', unit: 'lump sum', rate: '' } },
  { label: 'Accommodation', line: { description: 'Accommodation for the trainers', qty: '1', unit: 'lump sum', rate: '' } },
  { label: 'Kits and consumables', line: { description: 'Practical kits and consumables', qty: '1', unit: 'lump sum', rate: '' } },
  { label: 'Certificates', line: { description: 'Participation certificates', qty: '30', unit: 'per student', rate: '', perStudent: true } },
];

export function QuotationEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const [params] = useSearchParams();
  const enquiryId = params.get('enquiry');
  const copyFrom = params.get('from');
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('quotations');
  const navigate = useNavigate();
  const toast = useToast();

  const org = useQuery(fetchOrgBrand, []);
  const saved = useQuery(async () => {
    const rowId = isNew ? copyFrom : id;
    if (!rowId) return null;
    const { data, error } = await supabase.from('quotations').select('*').eq('id', rowId).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Quotation | null;
  }, [id, copyFrom]);
  const enquiry = useQuery(async () => {
    if (!isNew || !enquiryId) return null;
    const { data } = await supabase.from('site_enquiries').select('id, full_name, email, phone, organisation, interest, message, kind').eq('id', enquiryId).maybeSingle();
    return data;
  }, [enquiryId, isNew]);

  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fill the form once what it depends on has loaded.
  useEffect(() => {
    if (f || saved.loading || org.loading || enquiry.loading) return;
    const base = saved.data && !isNew ? fromQuotation(saved.data) : blank();
    if (isNew) {
      if (saved.data) Object.assign(base, fromQuotation(saved.data), { issued_on: isoDate(0), valid_until: isoDate(15), proposed_start: '', proposed_end: '' });
      if (enquiry.data) {
        Object.assign(base, {
          client_name: enquiry.data.full_name, client_email: enquiry.data.email ?? '', client_phone: enquiry.data.phone ?? '',
          organisation: enquiry.data.organisation ?? '', title: enquiry.data.interest ? `${enquiry.data.interest}` : base.title,
        });
      }
      base.prepared_by = base.prepared_by || profile?.full_name || '';
      base.prepared_phone = base.prepared_phone || profile?.phone || '';
      base.signatory_name = base.signatory_name || org.data?.signatoryName || '';
      base.signatory_designation = org.data?.signatoryTitle || base.signatory_designation;
    }
    setF(base);
  }, [f, saved.loading, saved.data, org.loading, org.data, enquiry.loading, enquiry.data, isNew, profile]);

  const draft = useMemo(() => (f ? toQuotation(f, isNew ? null : saved.data ?? null) : null), [f, isNew, saved.data]);

  if (!f || !draft) {
    if (saved.error) return <EmptyState title="Could not load this quotation" description={saved.error} />;
    return <Spinner />;
  }
  if (!isNew && !saved.data) return <EmptyState title="This quotation does not exist" action={<Link to="/admin/quotations" className="text-sm text-blue-600 hover:underline">Back to quotations</Link>} />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setError(null);
    setF((x) => {
      if (!x) return x;
      const next = { ...x, [k]: v };
      // Lines priced per student follow the number of participants.
      if (k === 'participants') next.lines = next.lines.map((l) => (l.perStudent ? { ...l, qty: String(Number(v) || 0) } : l));
      // A new issue date moves the validity with it, unless someone set a later one on purpose.
      if (k === 'issued_on' && typeof v === 'string' && v && next.valid_until < v) next.valid_until = isoDate(15, new Date(`${v}T00:00:00`));
      return next;
    });
  };
  const setLine = (i: number, patch: Partial<Line>) => set('lines', f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const toggleTopic = (t: string) => set('topics', f.topics.includes(t) ? f.topics.filter((x) => x !== t) : [...f.topics, t]);
  const custom = f.topics.filter((t) => !TOPIC_SUGGESTIONS.includes(t));

  const t = calcTotals(draft.items as never, Number(f.discount) || 0, Number(f.gst_percent) || 0);
  const brand = org.data;
  const pdfOpts = brand ? { org: brand, supportEmail: brand.supportEmail, signed } : null;

  const problems = (): string | null => {
    if (!clean(f.client_name)) return 'Enter the client contact’s name.';
    if (!clean(f.title)) return 'Enter what the quotation is for (the programme title).';
    if (!(Number(f.participants) >= 1)) return 'Enter the number of participants.';
    if (!f.issued_on || !f.valid_until) return 'Set the issue date and the valid-until date.';
    if (f.valid_until < f.issued_on) return 'The valid-until date cannot be before the issue date.';
    if (f.proposed_start && f.proposed_end && f.proposed_end < f.proposed_start) return 'The proposed end date cannot be before the start date.';
    if (clean(f.client_email) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(f.client_email))) return 'The client email does not look right.';
    const lines = f.lines.filter((l) => clean(l.description));
    if (!lines.length) return 'Add at least one priced line.';
    if (lines.some((l) => !(Number(l.qty) > 0) || !(Number(l.rate) >= 0) || l.rate.trim() === '')) return 'Every line needs a quantity above 0 and a rate.';
    if (t.subtotal <= 0) return 'The total is zero. Enter the rate for the workshop.';
    if ((Number(f.discount) || 0) > t.subtotal) return 'The discount cannot be more than the subtotal.';
    return null;
  };

  const row = () => {
    const q = toQuotation(f, null);
    return {
      client_name: q.client_name, client_designation: q.client_designation, organisation: q.organisation, client_email: q.client_email, client_phone: q.client_phone, client_address: q.client_address,
      title: q.title, programme_type: q.programme_type, topics: q.topics, participants: q.participants, duration_days: q.duration_days, hours_per_day: q.hours_per_day,
      mode: q.mode, venue: q.venue, proposed_start: q.proposed_start, proposed_end: q.proposed_end, dates_note: q.dates_note,
      issued_on: q.issued_on, valid_until: q.valid_until, items: q.items, discount_amount: q.discount_amount, gst_percent: q.gst_percent, gst_note: q.gst_note,
      inclusions: q.inclusions, terms: q.terms, payment_terms: q.payment_terms, notes: q.notes,
      prepared_by: q.prepared_by, prepared_phone: q.prepared_phone, signatory_name: q.signatory_name, signatory_designation: q.signatory_designation,
    };
  };

  const save = async (): Promise<Quotation | null> => {
    const p = problems();
    if (p) { setError(p); return null; }
    setBusy(true);
    try {
      if (isNew) {
        const { data, error: e } = await supabase.from('quotations').insert({ ...row(), enquiry_id: enquiryId || null }).select('*').single();
        if (e) throw new Error(e.message);
        toast(`Saved as ${(data as Quotation).quote_no}`);
        navigate(`/admin/quotations/${(data as Quotation).id}`, { replace: true });
        return data as Quotation;
      }
      const { data, error: e } = await supabase.from('quotations').update(row()).eq('id', id!).select('*').single();
      if (e) throw new Error(e.message);
      toast('Saved');
      saved.refetch();
      return data as Quotation;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const withPdf = async (action: 'preview' | 'download') => {
    const p = problems();
    if (p) return setError(p);
    if (!pdfOpts) return;
    setBusy(true);
    try {
      const q = toQuotation(f, isNew ? null : saved.data ?? null);
      if (action === 'preview') await previewQuotationPdf(q, pdfOpts);
      else await downloadQuotationPdf(q, pdfOpts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the PDF');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: QuoteStatus) => {
    if (isNew) return;
    setBusy(true);
    const { error: e } = await supabase.from('quotations').update({ status }).eq('id', id!);
    setBusy(false);
    if (e) return toast(e.message, 'error');
    toast(`Marked as ${STATUS_LABEL[status].toLowerCase()}`);
    saved.refetch();
  };

  const status = (saved.data?.status ?? 'draft') as QuoteStatus;
  const ro = !writable;

  return (
    <div>
      <Link to="/admin/quotations" className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"><ArrowLeft size={14} /> Quotations</Link>
      <PageHeader
        title={isNew ? 'New quotation' : saved.data?.quote_no ?? 'Quotation'}
        subtitle={isNew ? 'Fill in what the client asked for. The totals, the number and the PDF are made for you.' : `${saved.data?.organisation || saved.data?.client_name}, ${STATUS_LABEL[status].toLowerCase()}`}
        actions={!isNew && <Badge tone={status === 'accepted' ? 'green' : status === 'sent' ? 'blue' : status === 'declined' ? 'red' : 'neutral'}>{STATUS_LABEL[status]}</Badge>}
      />

      {enquiry.data && (
        <GlassCard className="mb-4 p-4 text-sm">
          <p className="font-medium text-neutral-900">The lead’s request (for reference)</p>
          <p className="mt-1 whitespace-pre-line text-neutral-600">{enquiry.data.message || enquiry.data.interest || 'No message.'}</p>
        </GlassCard>
      )}

      <fieldset disabled={ro} className="grid min-w-0 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Section title="Client">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name" required><TextInput value={f.client_name} maxLength={120} onChange={(e) => set('client_name', e.target.value)} /></Field>
              <Field label="Their role"><TextInput value={f.client_designation} maxLength={160} onChange={(e) => set('client_designation', e.target.value)} placeholder="e.g. Vice President, ECE Club" /></Field>
              <div className="sm:col-span-2"><Field label="Organisation"><TextInput value={f.organisation} maxLength={200} onChange={(e) => set('organisation', e.target.value)} placeholder="College, club or company" /></Field></div>
              <Field label="Email"><TextInput type="email" value={f.client_email} maxLength={200} onChange={(e) => set('client_email', e.target.value)} /></Field>
              <Field label="Phone"><TextInput value={f.client_phone} maxLength={30} onChange={(e) => set('client_phone', e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Address" hint="Optional. Printed under the client’s name."><TextArea rows={2} value={f.client_address} maxLength={400} onChange={(e) => set('client_address', e.target.value)} /></Field></div>
            </div>
          </Section>

          <Section title="Programme">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="What is this for?" required><TextInput value={f.title} maxLength={160} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Hands-on FPV drone workshop for ECE students" /></Field></div>
              <Field label="Type">
                <Select value={f.programme_type} onChange={(e) => set('programme_type', e.target.value as ProgrammeType)}>
                  {(Object.keys(PROGRAMME_LABEL) as ProgrammeType[]).map((k) => <option key={k} value={k}>{PROGRAMME_LABEL[k]}</option>)}
                </Select>
              </Field>
              <Field label="Participants" required><TextInput inputMode="numeric" value={f.participants} onChange={(e) => set('participants', e.target.value.replace(/\D/g, ''))} /></Field>
              <Field label="Duration (days)"><TextInput inputMode="decimal" value={f.duration_days} onChange={(e) => set('duration_days', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
              <Field label="Hours per day"><TextInput inputMode="decimal" value={f.hours_per_day} onChange={(e) => set('hours_per_day', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
              <Field label="Where">
                <Select value={f.mode} onChange={(e) => set('mode', e.target.value as DeliveryMode)}>
                  {(Object.keys(MODE_LABEL) as DeliveryMode[]).map((k) => <option key={k} value={k}>{MODE_LABEL[k]}</option>)}
                </Select>
              </Field>
              <Field label="Venue or city"><TextInput value={f.venue} maxLength={240} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. UIT, Karnavati University, Gandhinagar" /></Field>
              <Field label="Proposed start"><TextInput type="date" value={f.proposed_start} onChange={(e) => set('proposed_start', e.target.value)} /></Field>
              <Field label="Proposed end"><TextInput type="date" value={f.proposed_end} min={f.proposed_start || undefined} onChange={(e) => set('proposed_end', e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Dates note" hint="Optional, for example: flexible, weekends preferred."><TextInput value={f.dates_note} maxLength={240} onChange={(e) => set('dates_note', e.target.value)} /></Field></div>
            </div>
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-neutral-700">Topics to cover</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {TOPIC_SUGGESTIONS.map((s) => <Checkbox key={s} label={s} checked={f.topics.includes(s)} onChange={() => toggleTopic(s)} />)}
              </div>
              <ListEditor label="Other topics" items={custom} onChange={(v) => set('topics', [...f.topics.filter((x) => TOPIC_SUGGESTIONS.includes(x)), ...v])} />
            </div>
          </Section>

          <Section title="Pricing">
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_84px_110px_110px_32px] gap-2 text-xs text-neutral-500 sm:grid"><span>Description</span><span>Qty</span><span>Unit</span><span>Rate (₹)</span><span /></div>
              {f.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_84px_110px_110px_32px]">
                  <div className="col-span-2 sm:col-span-1"><TextInput aria-label="Description" value={l.description} maxLength={240} onChange={(e) => setLine(i, { description: e.target.value })} /></div>
                  <TextInput aria-label="Quantity" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/[^\d.]/g, ''), perStudent: false })} />
                  <TextInput aria-label="Unit" value={l.unit} maxLength={24} onChange={(e) => setLine(i, { unit: e.target.value })} placeholder="per student" />
                  <TextInput aria-label="Rate" inputMode="decimal" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" />
                  <button type="button" aria-label="Remove line" className="text-neutral-400 hover:text-red-600" onClick={() => set('lines', f.lines.filter((_, j) => j !== i))}><X size={16} /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => set('lines', [...f.lines, { description: '', qty: '1', unit: '', rate: '' }])}><Plus size={14} /> Add line</Button>
              {QUICK_LINES.map((q) => (
                <Button key={q.label} type="button" variant="ghost" onClick={() => set('lines', [...f.lines, { ...q.line, qty: q.line.perStudent ? String(Number(f.participants) || 0) : q.line.qty }])}>+ {q.label}</Button>
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Discount (₹)"><TextInput inputMode="decimal" value={f.discount} onChange={(e) => set('discount', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
              <Field label="GST (%)" hint="0 if GST is not charged."><TextInput inputMode="decimal" value={f.gst_percent} onChange={(e) => set('gst_percent', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
              <Field label="GST note" hint="Optional, printed under the total."><TextInput value={f.gst_note} maxLength={240} onChange={(e) => set('gst_note', e.target.value)} placeholder="e.g. GSTIN or “GST not applicable”" /></Field>
            </div>
          </Section>

          <Section title="Inclusions and terms">
            <ListEditor label="What is included" items={f.inclusions} onChange={(v) => set('inclusions', v)} />
            <div className="mt-4 space-y-4">
              <Field label="Payment terms"><TextArea rows={2} maxLength={1200} value={f.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} /></Field>
              <Field label="Terms and conditions" hint="One point per line."><TextArea rows={5} maxLength={4000} value={f.terms} onChange={(e) => set('terms', e.target.value)} /></Field>
              <Field label="Notes for the client" hint="Optional."><TextArea rows={2} maxLength={1500} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
            </div>
            <p className="mt-3 text-xs text-neutral-500">These are starting texts. Read them and change anything that does not match what you are offering this client.</p>
          </Section>

          <Section title="Dates and signature">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Issue date" required><TextInput type="date" value={f.issued_on} onChange={(e) => set('issued_on', e.target.value)} /></Field>
              <Field label="Valid until" required><TextInput type="date" value={f.valid_until} min={f.issued_on} onChange={(e) => set('valid_until', e.target.value)} /></Field>
              <Field label="Prepared by"><TextInput value={f.prepared_by} maxLength={120} onChange={(e) => set('prepared_by', e.target.value)} /></Field>
              <Field label="Contact phone"><TextInput value={f.prepared_phone} maxLength={30} onChange={(e) => set('prepared_phone', e.target.value)} /></Field>
              <Field label="Signatory name"><TextInput value={f.signatory_name} maxLength={120} onChange={(e) => set('signatory_name', e.target.value)} /></Field>
              <Field label="Signatory title"><TextInput value={f.signatory_designation} maxLength={200} onChange={(e) => set('signatory_designation', e.target.value)} /></Field>
            </div>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <GlassCard className="p-5">
            <h2 className="mb-3 font-semibold text-neutral-900">Summary</h2>
            <dl className="space-y-1.5 text-sm">
              <Row k="Issued" v={fmtDate(f.issued_on)} />
              <Row k="Valid until" v={fmtDate(f.valid_until)} />
              <Row k="Participants" v={f.participants || '-'} />
              <Row k="Subtotal" v={inr(t.subtotal)} />
              {(Number(f.discount) || 0) > 0 && <Row k="Discount" v={`- ${inr(Number(f.discount))}`} />}
              {(Number(f.gst_percent) || 0) > 0 && <Row k={`GST ${Number(f.gst_percent)}%`} v={inr(t.gst)} />}
            </dl>
            <div className="mt-3 rounded-2xl bg-neutral-900 px-4 py-3 text-white">
              <p className="text-xs text-white/70">Total</p>
              <p className="text-2xl font-semibold tabular-nums">{inr(t.total)}</p>
            </div>
            {t.total > 0 && <p className="mt-2 text-xs italic text-neutral-500">{amountInWords(t.total)}</p>}
            {Number(f.participants) > 0 && t.total > 0 && <p className="mt-1 text-xs text-neutral-500">About {inr(t.total / Number(f.participants))} per participant.</p>}
          </GlassCard>

          <GlassCard className="space-y-3 p-5">
            <Checkbox label="Print signature and company seal" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
            {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="grid gap-2">
              {!ro && <Button type="button" loading={busy} onClick={() => void save()}>{isNew ? 'Save quotation' : 'Save changes'}</Button>}
              <Button type="button" variant="secondary" disabled={busy || !pdfOpts} onClick={() => void withPdf('preview')}><Eye size={15} /> Preview PDF</Button>
              <Button type="button" variant="secondary" disabled={busy || !pdfOpts} onClick={() => void withPdf('download')}><Download size={15} /> Download PDF</Button>
            </div>
            {!ro && !isNew && (
              <div className="border-t border-black/5 pt-3">
                <p className="mb-2 text-xs font-medium text-neutral-500">Where does this stand?</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['sent', 'accepted', 'declined', 'expired', 'draft'] as QuoteStatus[]).filter((s) => s !== status).map((s) => (
                    <button key={s} type="button" disabled={busy} onClick={() => void setStatus(s)} className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm hover:bg-white">Mark {STATUS_LABEL[s].toLowerCase()}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-neutral-500">Download the PDF, send it to the client yourself, then mark it sent.</p>
              </div>
            )}
          </GlassCard>
        </aside>
      </fieldset>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard className="p-5">
      <h2 className="mb-4 font-semibold text-neutral-900">{title}</h2>
      {children}
    </GlassCard>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-neutral-500">{k}</dt><dd className="text-right tabular-nums text-neutral-900">{v}</dd></div>;
}
function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-neutral-700">{label}</p>
      <div className="mt-2 space-y-2">
        {items.map((h, i) => (
          <div key={i} className="grid grid-cols-[1fr_32px] items-center gap-2">
            <TextInput aria-label={`${label} ${i + 1}`} value={h} maxLength={200} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" aria-label="Remove" className="text-neutral-400 hover:text-red-600" onClick={() => onChange(items.filter((_, j) => j !== i))}><X size={16} /></button>
          </div>
        ))}
        <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => onChange([...items, ''])}>Add line</button>
      </div>
    </div>
  );
}
