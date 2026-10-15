import { useState } from 'react';
import type React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { useQuery } from '../../../lib/useQuery';
import { formatINR, gstIncluded, run, shopDb } from '../../../lib/shop';
import { Button, Field, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../../components/ui/kit';
import { GlassCard } from '../../../components/ui/shared';
import { Panel, StatusBadge, fmtDateTime } from './ShopUi';

const TABS = [
  { key: 'open', label: 'To ship', statuses: ['confirmed', 'packed'] },
  { key: 'shipped', label: 'Shipped', statuses: ['shipped'] },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { key: 'awaiting', label: 'Awaiting payment', statuses: ['awaiting_payment'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
  { key: 'all', label: 'All', statuses: [] as string[] },
];

type OrderRow = {
  id: string; customer_name: string; phone: string; total: number; status: string; payment_method: string;
  payment_status: string; created_at: string; address: { city?: string; state?: string } | null;
};

export function ShopOrders() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get('status')) ?? TABS[0];
  const term = (params.get('q') ?? '').trim();
  const [draft, setDraft] = useState(term);

  const q = useQuery(async () => {
    await shopDb.rpc('shop_expire_unpaid'); // release stock held by abandoned online payments
    let query = shopDb
      .from('shop_orders')
      .select('id, customer_name, phone, total, status, payment_method, payment_status, created_at, address')
      .order('created_at', { ascending: false })
      .limit(200);
    if (tab.statuses.length) query = query.in('status', tab.statuses);
    if (term) {
      const safe = term.replace(/[%,()]/g, '');
      query = query.or(`id.ilike.%${safe}%,customer_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`);
    }
    return (await run(query)) as OrderRow[];
  }, [tab.key, term]);

  const go = (status: string, search = term) => setParams({ status, ...(search ? { q: search } : {}) });

  return (
    <div>
      <PageHeader title="Orders" subtitle="Customers see the status you set here on the store’s Track order page." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap gap-1.5" aria-label="Order status">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-current={t.key === tab.key ? 'page' : undefined}
              onClick={() => go(t.key)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${t.key === tab.key ? 'bg-[#1a1a1a] text-white' : 'bg-white/60 text-neutral-700 hover:bg-white'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <form className="ml-auto flex gap-2" onSubmit={(e) => { e.preventDefault(); go(tab.key, draft.trim()); }}>
          <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Order ID, name or phone" aria-label="Search orders" className="w-56" />
          <Button type="submit" variant="secondary" aria-label="Search"><Search size={15} /></Button>
        </form>
      </div>

      {q.loading && !q.data ? (
        <Spinner />
      ) : q.error ? (
        <p className="text-sm text-red-600">Couldn’t load orders: {q.error}</p>
      ) : (
        <GlassCard className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-black/5 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Placed</th>
                <th className="px-3 py-3 font-medium">Payment</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {(q.data ?? []).map((o) => (
                <tr key={o.id} className="hover:bg-white/50">
                  <td className="px-4 py-3"><Link to={`/admin/shop/orders/${o.id}`} className="font-medium tabular-nums hover:underline">{o.id}</Link></td>
                  <td className="px-3 py-3">
                    {o.customer_name}
                    <p className="text-xs text-neutral-500">{[o.address?.city, o.address?.state].filter(Boolean).join(', ')}</p>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-neutral-500">{fmtDateTime(o.created_at)}</td>
                  <td className="px-3 py-3"><span className="mr-1.5 text-neutral-500">{o.payment_method === 'cod' ? 'COD' : 'Online'}</span><StatusBadge status={o.payment_status} /></td>
                  <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatINR(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!q.data?.length && <p className="p-8 text-center text-sm text-neutral-500">{term ? `No orders match “${term}”.` : 'No orders in this list.'}</p>}
        </GlassCard>
      )}
    </div>
  );
}

interface Order {
  id: string; status: string; payment_method: string; payment_status: string; customer_name: string; phone: string; email: string;
  address: { line1: string; line2?: string; city: string; state: string; pin: string }; gstin: string | null; company: string | null;
  subtotal: number; shipping: number; cod_fee: number; total: number; courier: string | null; tracking_number: string | null;
  staff_notes: string | null; created_at: string; paid_at: string | null; razorpay_order_id: string | null; razorpay_payment_id: string | null;
  shop_order_items: { id: number; name: string; variant_label: string | null; unit_price: number; qty: number; product_id: string | null }[];
}

export function ShopOrder() {
  const { id } = useParams();
  const q = useQuery(async () => (await run(shopDb.from('shop_orders').select('*, shop_order_items(*)').eq('id', id).maybeSingle())) as Order | null, [id]);
  const back = (
    <Link to="/admin/shop/orders" className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
      <ArrowLeft size={14} /> Orders
    </Link>
  );
  if (q.loading && !q.data) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">Couldn’t load this order: {q.error}</p>;
  const o = q.data;
  if (!o) return <div>{back}<p className="text-sm text-neutral-600">No order with this ID.</p></div>;
  const a = o.address;

  return (
    <div>
      {back}
      <PageHeader
        title={`Order ${o.id}`}
        subtitle={`Placed ${new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`}
        actions={<><StatusBadge status={o.status} /><StatusBadge status={o.payment_status} /></>}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel title="Items">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-black/5">
                {o.shop_order_items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2.5 pr-3">
                      {i.product_id ? <Link to={`/admin/shop/products/${i.product_id}`} className="hover:underline">{i.name}</Link> : i.name}
                      {i.variant_label && <p className="text-xs text-neutral-500">{i.variant_label}</p>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-neutral-500">{i.qty} × {formatINR(i.unit_price)}</td>
                    <td className="py-2.5 pl-3 text-right font-medium tabular-nums">{formatINR(i.qty * i.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-3 space-y-1 border-t border-black/5 pt-3 text-sm tabular-nums">
              <div className="flex justify-between"><dt className="text-neutral-500">Subtotal</dt><dd>{formatINR(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Shipping</dt><dd>{o.shipping ? formatINR(o.shipping) : 'Free'}</dd></div>
              {o.cod_fee ? <div className="flex justify-between"><dt className="text-neutral-500">COD fee</dt><dd>{formatINR(o.cod_fee)}</dd></div> : null}
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatINR(o.total)}</dd></div>
              <div className="flex justify-between text-neutral-500"><dt>Includes GST (18%)</dt><dd>{formatINR(gstIncluded(o.subtotal))}</dd></div>
            </dl>
          </Panel>

          {o.payment_method !== 'cod' && (
            <Panel title="Payment">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-neutral-500">Method</dt><dd>Online (Razorpay)</dd></div>
                <div><dt className="text-neutral-500">Paid at</dt><dd>{o.paid_at ? new Date(o.paid_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not paid yet'}</dd></div>
                <div><dt className="text-neutral-500">Razorpay order</dt><dd className="tabular-nums">{o.razorpay_order_id ?? 'Not created'}</dd></div>
                <div>
                  <dt className="text-neutral-500">Razorpay payment</dt>
                  <dd className="tabular-nums">
                    {o.razorpay_payment_id ? (
                      <a href={`https://dashboard.razorpay.com/app/payments/${o.razorpay_payment_id}`} target="_blank" rel="noopener" className="text-blue-600 hover:underline">{o.razorpay_payment_id}</a>
                    ) : 'None'}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-neutral-500">Refunds are issued from the Razorpay dashboard. Then set payment to Refunded here.</p>
            </Panel>
          )}

          <Panel title="Customer">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium">{o.customer_name}</p>
                <p><a href={`tel:+91${o.phone}`} className="hover:underline">+91 {o.phone}</a></p>
                <p><a href={`mailto:${o.email}`} className="hover:underline">{o.email}</a></p>
                {o.gstin && <p className="mt-2">GSTIN {o.gstin}{o.company ? `, ${o.company}` : ''}</p>}
              </div>
              <address className="not-italic">
                {a.line1}<br />
                {a.line2 && <>{a.line2}<br /></>}
                {a.city}, {a.state} {a.pin}
              </address>
            </div>
          </Panel>
        </div>

        <Fulfilment key={`${o.status}-${o.payment_status}-${o.tracking_number}`} o={o} onSaved={q.refetch} />
      </div>
    </div>
  );
}

function Fulfilment({ o, onSaved }: { o: Order; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    status: o.status, payment_status: o.payment_status, courier: o.courier ?? '', tracking_number: o.tracking_number ?? '', staff_notes: o.staff_notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const locked = o.status === 'cancelled';
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.status === 'cancelled' && !confirm('Cancel this order? Its items go back into stock, and it can’t be reopened.')) return;
    if (f.status === 'shipped' && !f.tracking_number.trim() && !confirm('Mark as shipped without a tracking number? The customer won’t be able to track the parcel.')) return;
    setSaving(true);
    try {
      await run(
        shopDb
          .from('shop_orders')
          .update({
            status: f.status,
            payment_status: f.payment_status,
            courier: f.courier.trim() || null,
            tracking_number: f.tracking_number.trim() || null,
            staff_notes: f.staff_notes.trim() || null,
          })
          .eq('id', o.id),
      );
      toast('Order updated. The customer sees the new status on Track order.');
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="lg:self-start">
      <Panel title="Fulfilment">
        <div className="space-y-4">
          {locked && <p className="text-sm text-neutral-500">This order was cancelled and its stock was returned. It can’t be changed.</p>}
          <Field label="Order status">
            <Select value={f.status} onChange={set('status')} disabled={locked}>
              {o.status === 'awaiting_payment' && <option value="awaiting_payment">Awaiting payment</option>}
              <option value="confirmed">Confirmed</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled (returns stock)</option>
            </Select>
          </Field>
          <Field label={`Payment (${o.payment_method === 'cod' ? 'cash on delivery' : 'online, Razorpay'})`}>
            <Select value={f.payment_status} onChange={set('payment_status')} disabled={locked}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Field label="Courier"><TextInput value={f.courier} onChange={set('courier')} disabled={locked} placeholder="e.g. Delhivery" /></Field>
            <Field label="Tracking number"><TextInput value={f.tracking_number} onChange={set('tracking_number')} disabled={locked} /></Field>
          </div>
          <Field label="Staff notes" hint="Not shown to the customer">
            <TextArea value={f.staff_notes} onChange={set('staff_notes')} disabled={locked} rows={3} />
          </Field>
          {!locked && <Button type="submit" loading={saving} className="w-full">Save order</Button>}
        </div>
      </Panel>
    </form>
  );
}
