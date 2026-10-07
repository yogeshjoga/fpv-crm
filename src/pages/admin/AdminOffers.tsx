import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileSignature, Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';
import { CareersNav } from '../../components/CareersNav';
import {
  EMPLOYMENT_LABEL,
  LEVEL_LABEL,
  OFFER_STATUS_LABEL,
  OFFER_STATUS_TONE,
  fmtDate,
  money,
  type EmploymentType,
  type Level,
  type Offer,
  type OfferStatus,
  type RoleTemplate,
} from '../../lib/offers';
import { downloadOfferPdf } from '../../lib/offerPdf';
import { fetchOrgBrand } from '../../lib/useOrgBrand';
import { OfferEditor } from './OfferEditor';

/** A one-line description of what the candidate is paid (or pays). */
function payLine(o: Offer) {
  if (o.compensation_mode === 'unpaid') return 'Unpaid';
  if (o.compensation_mode === 'pay_to_train') return `Pays ${money(o.training_fee) || '—'} for training, then ${money(o.post_training_amount) || '—'} / month`;
  if (o.pay_amount === null) return 'Pay not set';
  return `${money(o.pay_amount)} / ${o.pay_period === 'year' ? 'year' : 'month'}`;
}

/** Offer letters (HR): prepare, issue and download a letter and job description for a named candidate. */
export function AdminOffers() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const ro = !canWrite('careers');
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<{ offer: Offer | null; initial?: Partial<Offer> } | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | OfferStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery(async () => {
    const [offers, templates] = await Promise.all([
      unwrap(supabase.from('careers_offers').select('*').order('created_at', { ascending: false })) as Promise<Offer[]>,
      unwrap(supabase.from('careers_role_templates').select('*').order('sort_order').order('title')) as Promise<RoleTemplate[]>,
    ]);
    return { offers, templates };
  }, []);

  // "Make an offer letter" from an applicant opens the editor with the applicant already filled in.
  const appId = params.get('application');
  useEffect(() => {
    if (!appId || !q.data || ro) return;
    const existing = q.data.offers.find((o) => o.application_id === appId && o.status !== 'withdrawn' && o.status !== 'declined');
    const kind = params.get('kind');
    const title = params.get('role') ?? '';
    const tpl = q.data.templates.find((t) => t.title.toLowerCase() === title.toLowerCase());
    setEditing(
      existing
        ? { offer: existing }
        : {
            offer: null,
            initial: {
              application_id: appId,
              candidate_name: params.get('name') ?? '',
              candidate_email: params.get('email') ?? '',
              role_title: title,
              role_template_id: tpl?.id ?? null,
              department: tpl?.department ?? '',
              employment_type: kind === 'internship' ? 'internship' : 'full_time',
              level: kind === 'internship' ? 'intern' : 'fresher',
            },
          },
    );
    setParams({}, { replace: true });
  }, [appId, q.data, ro, params, setParams]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data?.offers ?? []).filter((o) => (status === 'all' || o.status === status) && (!s || `${o.candidate_name} ${o.role_title} ${o.offer_no} ${o.candidate_email}`.toLowerCase().includes(s)));
  }, [q.data, search, status]);

  const download = async (o: Offer) => {
    setBusyId(o.id);
    try {
      await downloadOfferPdf('offer', o, await fetchOrgBrand(), 'signed');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not make the PDF', 'error');
    } finally {
      setBusyId(null);
    }
  };
  const setOfferStatus = async (o: Offer, next: OfferStatus) => {
    setBusyId(o.id);
    const { error } = await supabase.from('careers_offers').update({ status: next }).eq('id', o.id);
    setBusyId(null);
    if (error) return toast(error.message, 'error');
    if (next === 'issued' && o.application_id) await supabase.from('careers_applications').update({ status: 'offered' } as never).eq('id', o.application_id);
    toast(`Marked ${OFFER_STATUS_LABEL[next].toLowerCase()}`);
    q.refetch();
  };
  const remove = async (o: Offer) => {
    if (!window.confirm(`Delete the draft offer for ${o.candidate_name}?`)) return;
    const { error } = await supabase.from('careers_offers').delete().eq('id', o.id);
    if (error) return toast(error.message, 'error');
    toast('Deleted');
    q.refetch();
  };

  if (q.loading && !q.data) return <Spinner />;
  const templates = q.data?.templates ?? [];

  return (
    <div>
      <PageHeader
        title="Offer letters"
        subtitle="Give a candidate's name and a role. The job description and the letter are prepared, and you set dates, pay and terms"
        actions={
          !ro && (
            <Button onClick={() => setEditing({ offer: null })}>
              <Plus size={16} /> New offer letter
            </Button>
          )
        }
      />
      <CareersNav />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <TextInput className="!pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a candidate or role…" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as 'all' | OfferStatus)} className="!w-auto">
          <option value="all">All statuses</option>
          {(Object.keys(OFFER_STATUS_LABEL) as OfferStatus[]).map((s) => (
            <option key={s} value={s}>
              {OFFER_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {!rows.length ? (
        <EmptyState
          icon={<FileSignature size={22} />}
          title={q.data?.offers.length ? 'No offer letters match' : 'No offer letters yet'}
          description="Create one with a candidate's name. The role's job description is filled in, and you can edit anything before you download or issue it."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((o) => (
            <GlassCard key={o.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button className="min-w-0 text-left" onClick={() => setEditing({ offer: o })}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-900">{o.candidate_name}</span>
                    <Badge tone={OFFER_STATUS_TONE[o.status as OfferStatus]}>{OFFER_STATUS_LABEL[o.status as OfferStatus]}</Badge>
                  </div>
                  <div className="mt-0.5 text-sm text-neutral-600">
                    {o.role_title} · {LEVEL_LABEL[o.level as Level]} · {EMPLOYMENT_LABEL[o.employment_type as EmploymentType]}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {o.offer_no} · {fmtDate(o.issued_on)}
                    {o.start_date ? ` · starts ${fmtDate(o.start_date)}` : ''} · {payLine(o)}
                  </div>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => download(o)} loading={busyId === o.id}>
                    <Download size={15} /> PDF
                  </Button>
                  {!ro && (
                    <>
                      <Button variant="secondary" onClick={() => setEditing({ offer: o })}>
                        Edit
                      </Button>
                      {o.status === 'draft' && (
                        <>
                          <Button onClick={() => setOfferStatus(o, 'issued')} disabled={busyId === o.id}>
                            Issue
                          </Button>
                          <Button variant="ghost" className="text-red-600" onClick={() => remove(o)}>
                            Delete
                          </Button>
                        </>
                      )}
                      {o.status === 'issued' && (
                        <Button variant="ghost" className="text-red-600" onClick={() => setOfferStatus(o, 'withdrawn')} disabled={busyId === o.id}>
                          Withdraw
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {editing && (
        <OfferEditor
          key={editing.offer?.id ?? 'new'}
          offer={editing.offer}
          initial={editing.initial}
          templates={templates}
          onClose={() => setEditing(null)}
          onSaved={() => q.refetch()}
        />
      )}
    </div>
  );
}
