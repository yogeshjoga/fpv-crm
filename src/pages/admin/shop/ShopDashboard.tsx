import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useQuery } from '../../../lib/useQuery';
import { SHOP_URL, formatINR, run, shopDb } from '../../../lib/shop';
import { PageHeader, Spinner } from '../../../components/ui/kit';
import { Panel, StatTile, StatusBadge } from './ShopUi';

interface Stats {
  revenue_today: number;
  revenue_30d: number;
  orders_30d: number;
  to_ship: number;
  awaiting_payment: number;
  products: number;
  low_stock: number;
  daily: { day: string; revenue: number; orders: number }[];
  top_products: { name: string; qty: number; revenue: number }[];
}
type Recent = { id: string; customer_name: string; total: number; status: string; created_at: string };
type LowRow = { key: string; productId: string; name: string; stock: number };

async function load() {
  await shopDb.rpc('shop_expire_unpaid'); // release stock held by abandoned online payments
  const [stats, recent, lowProducts, lowVariants] = await Promise.all([
    run(shopDb.rpc('shop_dashboard_stats')),
    run(shopDb.from('shop_orders').select('id, customer_name, total, status, created_at').order('created_at', { ascending: false }).limit(8)),
    run(shopDb.from('shop_products').select('id, name, stock, low_stock_at').is('variant_name', null).eq('is_published', true).order('stock').limit(50)),
    run(
      shopDb
        .from('shop_product_variants')
        .select('id, label, stock, shop_products!inner(id, name, low_stock_at, is_published)')
        .eq('shop_products.is_published', true)
        .order('stock')
        .limit(50),
    ),
  ]);
  type P = { id: string; name: string; stock: number; low_stock_at: number };
  type V = { id: string; label: string; stock: number; shop_products: { id: string; name: string; low_stock_at: number } };
  const low: LowRow[] = [
    ...((lowProducts ?? []) as P[]).filter((p) => p.stock <= p.low_stock_at).map((p) => ({ key: p.id, productId: p.id, name: p.name, stock: p.stock })),
    ...((lowVariants ?? []) as unknown as V[])
      .filter((v) => v.stock <= v.shop_products.low_stock_at)
      .map((v) => ({ key: v.id, productId: v.shop_products.id, name: `${v.shop_products.name} (${v.label})`, stock: v.stock })),
  ].sort((a, b) => a.stock - b.stock);
  return { s: (stats ?? {}) as Stats, recent: (recent ?? []) as Recent[], low };
}

export function ShopDashboard() {
  const q = useQuery(load, []);

  return (
    <div>
      <PageHeader
        title="Shop dashboard"
        subtitle="Live numbers from the EgireRobotics store."
        actions={
          <a href={SHOP_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-sm text-neutral-700 shadow-sm hover:bg-white">
            Open store <ExternalLink size={14} />
          </a>
        }
      />
      {q.loading && !q.data ? (
        <Spinner />
      ) : q.error ? (
        <p className="text-sm text-red-600">Couldn’t load the shop: {q.error}</p>
      ) : q.data ? (
        <Content {...q.data} />
      ) : null}
    </div>
  );
}

function Content({ s, recent, low }: { s: Stats; recent: Recent[]; low: LowRow[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Revenue today" value={formatINR(s.revenue_today ?? 0)} />
        <StatTile label="Revenue, 30 days" value={formatINR(s.revenue_30d ?? 0)} note={`${s.orders_30d ?? 0} orders`} />
        <StatTile
          label="Orders to ship"
          value={String(s.to_ship ?? 0)}
          note={s.awaiting_payment ? `${s.awaiting_payment} more awaiting payment` : 'Confirmed or packed'}
          to="/admin/shop/orders?status=open"
        />
        <StatTile label="Low or out of stock" value={String(low.length)} note={`of ${s.products ?? 0} live products`} to="/admin/shop/products?filter=low" />
      </div>

      <RevenueChart days={s.daily ?? []} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Recent orders" action={<Link to="/admin/shop/orders" className="text-sm text-blue-600 hover:underline">All orders</Link>}>
          {recent.length ? (
            <ul className="divide-y divide-black/5 text-sm">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/shop/orders/${o.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2.5 hover:bg-white/60">
                    <span className="w-28 shrink-0 font-medium tabular-nums">{o.id}</span>
                    <span className="min-w-0 flex-1 truncate">{o.customer_name}</span>
                    <StatusBadge status={o.status} />
                    <span className="w-24 shrink-0 text-right font-medium tabular-nums">{formatINR(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">No orders yet. They appear here the moment a customer checks out.</p>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Needs restocking" action={<Link to="/admin/shop/products?filter=low" className="text-sm text-blue-600 hover:underline">Update stock</Link>}>
            {low.length ? (
              <ul className="space-y-2 text-sm">
                {low.slice(0, 8).map((r) => (
                  <li key={r.key} className="flex items-center justify-between gap-3">
                    <Link to={`/admin/shop/products/${r.productId}`} className="min-w-0 truncate hover:underline">{r.name}</Link>
                    <span className={`shrink-0 font-medium tabular-nums ${r.stock === 0 ? 'text-red-600' : 'text-amber-700'}`}>{r.stock === 0 ? 'Out' : `${r.stock} left`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">Everything is above its low-stock level.</p>
            )}
          </Panel>

          <Panel title="Top sellers, 30 days">
            {s.top_products?.length ? (
              <ul className="space-y-2 text-sm">
                {s.top_products.map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{t.name}</span>
                    <span className="shrink-0 tabular-nums text-neutral-500">{t.qty} sold, {formatINR(t.revenue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">Best sellers show up after the first orders.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const compact = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${(n / 1e3).toFixed(0)}k` : `₹${n}`;

/** Single-series daily revenue: one hue, the title names it, so no legend. */
function RevenueChart({ days }: { days: { day: string; revenue: number; orders: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const h = 180;
  const n = days.length;
  const active = hover !== null ? days[hover] : null;

  return (
    <Panel>
      <figure>
        <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-neutral-900">Revenue, last 30 days</h2>
          <p className="text-sm text-neutral-500" aria-live="polite">
            {active ? (
              <>
                {fmtDay(active.day)}: <b className="tabular-nums text-neutral-900">{formatINR(active.revenue)}</b> from {active.orders} {active.orders === 1 ? 'order' : 'orders'}
              </>
            ) : (
              'Hover a bar for the day’s total. Cancelled orders are excluded.'
            )}
          </p>
        </figcaption>
        <div className="mt-4 flex gap-2">
          <div className="relative w-10 shrink-0 text-right text-[11px] tabular-nums text-neutral-500" style={{ height: h }} aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: h - (t / top) * h }}>{compact(t)}</span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1" style={{ height: h }} onMouseLeave={() => setHover(null)}>
            {ticks.slice(1).map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-black/5" style={{ top: h - (t / top) * h }} aria-hidden="true" />
            ))}
            <div className="absolute inset-x-0 bottom-0 border-t border-neutral-400" aria-hidden="true" />
            <div className="absolute inset-0 flex items-end" style={{ gap: 2 }}>
              {days.map((d, i) => (
                <button
                  key={d.day}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${fmtDay(d.day)}: ${formatINR(d.revenue)}, ${d.orders} orders`}
                  className="relative flex h-full flex-1 items-end"
                >
                  <span
                    className={`block w-full rounded-t-[4px] ${hover === null || hover === i ? 'bg-blue-600' : 'bg-blue-600/35'}`}
                    style={{ height: d.revenue ? Math.max(2, (d.revenue / top) * h) : 0 }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="ml-12 mt-2 flex justify-between text-[11px] text-neutral-500" aria-hidden="true">
          <span>{n ? fmtDay(days[0].day) : ''}</span>
          <span>{n ? fmtDay(days[Math.floor(n / 2)].day) : ''}</span>
          <span>{n ? fmtDay(days[n - 1].day) : ''}</span>
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-neutral-500 hover:text-neutral-900">Show as table</summary>
          <table className="mt-2 w-full tabular-nums">
            <thead>
              <tr className="text-left text-neutral-500"><th className="py-1 font-medium">Day</th><th className="py-1 text-right font-medium">Orders</th><th className="py-1 text-right font-medium">Revenue</th></tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t border-black/5"><td className="py-1">{fmtDay(d.day)}</td><td className="py-1 text-right">{d.orders}</td><td className="py-1 text-right">{formatINR(d.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </figure>
    </Panel>
  );
}
