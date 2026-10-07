import { useState } from 'react';
import { Download, FileSignature } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, useToast } from '../../components/ui/kit';
import { EMPLOYMENT_LABEL, OFFER_STATUS_LABEL, OFFER_STATUS_TONE, compensationParagraphs, fmtDate, type EmploymentType, type Offer, type OfferStatus } from '../../lib/offers';
import { downloadOfferPdf } from '../../lib/offerPdf';
import { fetchOrgBrand } from '../../lib/useOrgBrand';

/** The student's own offer letters: read, download, accept or decline. */
export function MyOffers({ uid }: { uid: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery(() => unwrap(supabase.from('careers_offers').select('*').order('issued_on', { ascending: false })) as Promise<Offer[]>, [uid]);
  const offers = q.data ?? [];
  if (!offers.length) return null;

  const download = async (o: Offer) => {
    setBusy(o.id + 'pdf');
    try {
      await downloadOfferPdf('offer', o, await fetchOrgBrand(), 'signed');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not make the PDF', 'error');
    } finally {
      setBusy(null);
    }
  };
  const respond = async (o: Offer, accept: boolean) => {
    if (!window.confirm(accept ? 'Accept this offer and its terms?' : 'Decline this offer? This cannot be undone.')) return;
    setBusy(o.id + (accept ? 'yes' : 'no'));
    const { error } = await supabase.rpc('careers_respond_offer', { p_offer: o.id, p_accept: accept });
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast(accept ? 'Offer accepted. Welcome aboard!' : 'Offer declined');
    q.refetch();
  };

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">My offer letters</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((o) => {
          const expired = o.valid_until !== null && o.valid_until < new Date().toISOString().slice(0, 10);
          return (
            <GlassCard key={o.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-neutral-900">
                    <FileSignature size={16} className="text-blue-500" /> {o.role_title}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {EMPLOYMENT_LABEL[o.employment_type as EmploymentType]} · {o.offer_no} · {fmtDate(o.issued_on)}
                  </div>
                </div>
                <Badge tone={OFFER_STATUS_TONE[o.status as OfferStatus]}>{OFFER_STATUS_LABEL[o.status as OfferStatus]}</Badge>
              </div>
              <div className="mt-3 space-y-1 text-sm text-neutral-700">
                {o.start_date && (
                  <div>
                    Starts <span className="font-medium">{fmtDate(o.start_date)}</span>
                    {o.end_date ? ` and ends ${fmtDate(o.end_date)}` : ''}
                  </div>
                )}
                {compensationParagraphs(o)
                  .slice(0, 2)
                  .map((p, i) => (
                    <div key={i} className="text-neutral-600">
                      {p}
                    </div>
                  ))}
                {o.status === 'issued' && o.valid_until && (
                  <div className={`text-xs ${expired ? 'text-red-600' : 'text-amber-700'}`}>{expired ? 'This offer has expired' : `Please respond by ${fmtDate(o.valid_until)}`}</div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => download(o)} loading={busy === o.id + 'pdf'}>
                  <Download size={15} /> Download letter
                </Button>
                {o.status === 'issued' && !expired && (
                  <>
                    <Button onClick={() => respond(o, true)} loading={busy === o.id + 'yes'}>
                      Accept
                    </Button>
                    <Button variant="ghost" className="text-red-600" onClick={() => respond(o, false)} loading={busy === o.id + 'no'}>
                      Decline
                    </Button>
                  </>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
