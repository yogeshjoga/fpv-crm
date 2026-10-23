import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Download, FilePlus2, FileText, Link2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { fetchOrgBrand } from '../../lib/useOrgBrand';
import { STATUS_LABEL, STATUS_TONE, fmtDate, inr, isoDate, type Quotation, type QuoteStatus } from '../../lib/quotations';
import { downloadQuotationPdf } from '../../lib/quotationPdf';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, PageHeader, Spinner, TextInput, useToast } from '../../components/ui/kit';

const FILTERS: (QuoteStatus | 'all')[] = ['all', 'draft', 'sent', 'accepted', 'declined', 'expired'];

/** A quotation that was sent but whose validity has passed counts as expired, even before anyone marks it. */
const effectiveStatus = (q: Quotation): QuoteStatus => (q.status === 'sent' && q.valid_until < isoDate(0) ? 'expired' : (q.status as QuoteStatus));

export function AdminQuotations() {
  const toast = useToast();
  const navigate = useNavigate();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('quotations');
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery(() => unwrap(supabase.from('quotations').select('*').order('created_at', { ascending: false }).limit(500)) as Promise<Quotation[]>, []);
  const all = q.data ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const s of FILTERS.slice(1)) c[s] = all.filter((x) => effectiveStatus(x) === s).length;
    return c;
  }, [all]);
  const money = useMemo(() => {
    const sum = (s: QuoteStatus) => all.filter((x) => effectiveStatus(x) === s).reduce((n, x) => n + Number(x.total), 0);
    return { open: sum('sent'), won: sum('accepted') };
  }, [all]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter(
      (x) => (filter === 'all' || effectiveStatus(x) === filter) && (!needle || [x.quote_no, x.client_name, x.organisation, x.title].some((v) => (v ?? '').toLowerCase().includes(needle))),
    );
  }, [all, filter, search]);

  const pdf = async (x: Quotation) => {
    setBusy(x.id);
    try {
      const org = await fetchOrgBrand();
      await downloadQuotationPdf(x, { org, supportEmail: org.supportEmail, signed: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not build the PDF', 'error');
    } finally {
      setBusy(null);
    }
  };
  const remove = async (x: Quotation) => {
    if (!confirm(`Delete the draft ${x.quote_no}? This cannot be undone.`)) return;
    setBusy(x.id);
    const { error } = await supabase.from('quotations').delete().eq('id', x.id);
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast('Draft deleted');
    q.refetch();
  };

  if (!q.data) return q.error ? <EmptyState icon={<FileText size={22} />} title="Could not load quotations" description={q.error} /> : <Spinner />;

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Workshop and training quotations for colleges, clubs and companies, with the PDF ready to send."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/admin/quotations/requests')}><Link2 size={15} /> Requirement forms</Button>
            {writable && <Button onClick={() => navigate('/admin/quotations/new')}><FilePlus2 size={15} /> New quotation</Button>}
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Waiting for an answer" value={inr(money.open)} note={`${counts.sent} sent`} />
        <Stat label="Accepted" value={inr(money.won)} note={`${counts.accepted} quotation${counts.accepted === 1 ? '' : 's'}`} />
        <Stat label="Drafts" value={String(counts.draft)} note="Not sent yet" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filter === s ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-700 hover:bg-white'}`}>
            {s === 'all' ? 'All' : STATUS_LABEL[s]} <span className="opacity-60">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="mb-5"><TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number, client, organisation or programme" /></div>

      {!rows.length ? (
        <EmptyState
          icon={<FileText size={22} />}
          title={all.length ? 'No quotations match' : 'No quotations yet'}
          description={all.length ? 'Try another status or search.' : writable ? 'Create one from scratch, or open an enquiry and choose “Create quotation” to start with the lead’s details.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((x) => {
            const st = effectiveStatus(x);
            return (
              <GlassCard key={x.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link to={`/admin/quotations/${x.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-neutral-500">{x.quote_no}</span>
                      <span className="font-medium text-neutral-900">{x.organisation || x.client_name}</span>
                      <Badge tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{x.title} · {x.participants} participants{x.organisation ? ` · ${x.client_name}` : ''}</p>
                    <p className="mt-1 text-xs text-neutral-500">Issued {fmtDate(x.issued_on)} · valid until {fmtDate(x.valid_until)}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-2 text-lg font-semibold tabular-nums text-neutral-900">{inr(Number(x.total))}</span>
                    <Button variant="ghost" title="Download PDF" disabled={busy === x.id} onClick={() => void pdf(x)}><Download size={15} /></Button>
                    {writable && <Button variant="ghost" title="Make a copy for another client" onClick={() => navigate(`/admin/quotations/new?from=${x.id}`)}><Copy size={15} /></Button>}
                    {writable && x.status === 'draft' && <Button variant="ghost" title="Delete draft" disabled={busy === x.id} onClick={() => void remove(x)}><Trash2 size={15} /></Button>}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{note}</p>
    </GlassCard>
  );
}
