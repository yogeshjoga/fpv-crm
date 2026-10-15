import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useQuery } from '../../../lib/useQuery';
import { CATEGORIES, SHOP_URL, categoryName, formatINR, run, shopDb } from '../../../lib/shop';
import { Badge, Button, PageHeader, Select, Spinner, TextInput, useToast } from '../../../components/ui/kit';
import { GlassCard } from '../../../components/ui/shared';

interface Row {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  low_stock_at: number;
  is_published: boolean;
  variant_name: string | null;
  source: string;
  shop_product_variants: { id: string; label: string; price: number; stock: number; sort: number }[];
}

const totalStock = (r: Row) => (r.variant_name ? r.shop_product_variants.reduce((n, v) => n + v.stock, 0) : r.stock);

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'unpriced', label: 'Needs price' },
  { key: 'low', label: 'Low stock' },
  { key: 'out', label: 'Out of stock' },
  { key: 'hidden', label: 'Hidden' },
];
const PAGE = 50;

// The API returns at most 1,000 rows per request, so page through the whole catalog.
async function loadAll() {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const data = (await run(
      shopDb
        .from('shop_products')
        .select('id, sku, slug, name, brand, category, price, stock, low_stock_at, is_published, variant_name, source, shop_product_variants(id, label, price, stock, sort)')
        .order('is_published', { ascending: false })
        .order('updated_at', { ascending: false })
        .order('id')
        .range(from, from + 999),
    )) as Row[];
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

export function ShopProducts() {
  const q = useQuery(loadAll, []);
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.some((f) => f.key === params.get('filter')) ? params.get('filter')! : 'all';
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [brand, setBrand] = useState('');
  const [page, setPage] = useState(0);
  // Edits made on this page, applied over the loaded rows so the table doesn't reload thousands of rows.
  const [patches, setPatches] = useState<Record<string, Partial<Row> | null>>({});

  const rows = useMemo(
    () => (q.data ?? []).filter((r) => patches[r.id] !== null).map((r) => (patches[r.id] ? { ...r, ...patches[r.id] } : r)),
    [q.data, patches],
  );
  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand))].sort((a, b) => a.localeCompare(b)), [rows]);
  const shown = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      const hay = `${r.name} ${r.brand} ${r.sku}`.toLowerCase();
      if (words.some((w) => !hay.includes(w))) return false;
      if (cat && r.category !== cat) return false;
      if (brand && r.brand !== brand) return false;
      const s = totalStock(r);
      if (filter === 'live') return r.is_published;
      if (filter === 'unpriced') return !r.price;
      if (filter === 'low') return r.is_published && s <= r.low_stock_at;
      if (filter === 'out') return s === 0;
      if (filter === 'hidden') return !r.is_published;
      return true;
    });
  }, [rows, search, cat, brand, filter]);
  const counts = useMemo(() => ({ unpriced: rows.filter((r) => !r.price).length, live: rows.filter((r) => r.is_published).length }), [rows]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = shown.slice(current * PAGE, current * PAGE + PAGE);

  const patch = (id: string, p: Partial<Row> | null) => setPatches((x) => ({ ...x, [id]: p === null ? null : { ...(x[id] ?? {}), ...p } }));

  return (
    <div>
      <PageHeader
        title="Products & stock"
        subtitle="Official products come from each brand with their photos and descriptions. Set the price and stock, then switch them on."
        actions={
          <Link to="/admin/shop/products/new">
            <Button><Plus size={16} /> Add product</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search name, brand or SKU" aria-label="Search products" className="max-w-xs" />
        <Select value={brand} onChange={(e) => { setBrand(e.target.value); setPage(0); }} aria-label="Brand" className="w-auto">
          <option value="">All brands</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
        <Select value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }} aria-label="Category" className="w-auto">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Select>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => { setParams(f.key === 'all' ? {} : { filter: f.key }, { replace: true }); setPage(0); }}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${filter === f.key ? 'bg-[#1a1a1a] text-white' : 'bg-white/60 text-neutral-700 hover:bg-white'}`}
          >
            {f.label}
            {f.key === 'unpriced' ? ` (${counts.unpriced})` : f.key === 'live' ? ` (${counts.live})` : ''}
          </button>
        ))}
        <span className="ml-auto text-sm tabular-nums text-neutral-500">{shown.length} of {rows.length}</span>
      </div>

      {q.loading && !q.data ? (
        <Spinner label="Loading the catalog…" />
      ) : q.error ? (
        <p className="text-sm text-red-600">Couldn’t load products: {q.error}</p>
      ) : (
        <GlassCard className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-black/5 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 text-right font-medium">Price</th>
                <th className="px-3 py-3 font-medium">Stock</th>
                <th className="px-3 py-3 font-medium">On store</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {visible.map((r) => <ProductRow key={r.id} r={r} patch={patch} />)}
            </tbody>
          </table>
          {shown.length === 0 && <p className="p-8 text-center text-sm text-neutral-500">No products match. Clear the search or pick another filter.</p>}
        </GlassCard>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          <Button variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button>
          <span className="tabular-nums text-neutral-500">
            Page {current + 1} of {pages}, showing {current * PAGE + 1}–{Math.min(shown.length, current * PAGE + PAGE)} of {shown.length}
          </span>
          <Button variant="secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</Button>
        </nav>
      )}
    </div>
  );
}

function ProductRow({ r, patch }: { r: Row; patch: (id: string, p: Partial<Row> | null) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const variants = r.variant_name ? [...r.shop_product_variants].sort((a, b) => a.sort - b.sort) : [];
  const s = totalStock(r);

  async function act(fn: () => Promise<unknown>, ok: string, after: () => void) {
    setBusy(true);
    try {
      await fn();
      after();
      toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const setStock = (n: number, variantId?: string) =>
    act(
      () => run(variantId ? shopDb.from('shop_product_variants').update({ stock: n }).eq('id', variantId) : shopDb.from('shop_products').update({ stock: n }).eq('id', r.id)),
      `${r.name}: stock set to ${n}`,
      () =>
        patch(r.id, variantId ? { shop_product_variants: r.shop_product_variants.map((v) => (v.id === variantId ? { ...v, stock: n } : v)) } : { stock: n }),
    );

  const setLive = (live: boolean) =>
    act(
      () => run(shopDb.from('shop_products').update({ is_published: live }).eq('id', r.id)),
      live ? `${r.name} is live on the store` : `${r.name} is hidden from the store`,
      () => patch(r.id, { is_published: live }),
    );

  const remove = () => {
    if (!confirm(`Delete “${r.name}” permanently? Past orders keep their line items. To take it off the store for now, use the On store switch instead.`)) return;
    act(() => run(shopDb.from('shop_products').delete().eq('id', r.id)), `${r.name} deleted`, () => patch(r.id, null));
  };

  return (
    <tr className={`align-top ${busy ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <Link to={`/admin/shop/products/${r.id}`} className="font-medium text-neutral-900 hover:underline">{r.name}</Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          {r.brand}, SKU {r.sku}
          {r.source !== 'manual' && <Badge tone="blue">Official</Badge>}
          {!r.price && <Badge tone="amber">Needs price</Badge>}
        </p>
      </td>
      <td className="px-3 py-3 text-neutral-500">{categoryName.get(r.category) ?? r.category}</td>
      <td className="px-3 py-3 text-right tabular-nums">{r.price ? formatINR(r.price) : <span className="text-neutral-400">Not set</span>}</td>
      <td className="px-3 py-3">
        {variants.length ? (
          <div className="space-y-1.5">
            {variants.map((v) => <StockInput key={v.id} label={v.label} value={v.stock} low={r.low_stock_at} onSave={(n) => setStock(n, v.id)} />)}
          </div>
        ) : (
          <StockInput value={r.stock} low={r.low_stock_at} onSave={(n) => setStock(n)} />
        )}
        {s === 0 ? <p className="mt-1 text-xs font-medium text-red-600">Out of stock</p> : s <= r.low_stock_at ? <p className="mt-1 text-xs font-medium text-amber-700">Low stock</p> : null}
      </td>
      <td className="px-3 py-3">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="peer sr-only" checked={r.is_published} disabled={busy} onChange={(e) => setLive(e.target.checked)} />
          <span className="relative h-5 w-9 rounded-full bg-neutral-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-green-600 peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-blue-500" />
          <span className="text-xs text-neutral-500">{r.is_published ? 'Live' : 'Hidden'}</span>
        </label>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <Link to={`/admin/shop/products/${r.id}`} className="text-blue-600 hover:underline">Edit</Link>
        {r.is_published && <a href={`${SHOP_URL}/product/${r.slug}`} target="_blank" rel="noopener" className="ml-3 text-neutral-500 hover:text-neutral-900">View</a>}
        {r.source === 'manual' && <button type="button" onClick={remove} className="ml-3 text-red-600 hover:underline">Delete</button>}
      </td>
    </tr>
  );
}

function StockInput({ value, low, label, onSave }: { value: number; low: number; label?: string; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setV(String(value));
  }
  const dirty = v !== String(value);
  const save = () => {
    if (!dirty) return;
    const n = Number(v);
    if (v === '' || !Number.isInteger(n) || n < 0) return setV(String(value));
    onSave(n);
  };
  return (
    <label className="flex items-center gap-2">
      <input
        value={v}
        inputMode="numeric"
        onChange={(e) => setV(e.target.value.replace(/\D/g, ''))}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setV(String(value));
        }}
        aria-label={label ? `Stock for ${label}` : 'Stock'}
        className={`h-8 w-16 rounded-lg border px-2 text-right tabular-nums outline-none focus:border-blue-400 ${
          dirty ? 'border-amber-400 bg-amber-50' : value <= low ? 'border-amber-300 bg-white' : 'border-white/70 bg-white/80'
        }`}
      />
      {label && <span className="text-xs text-neutral-500">{label}</span>}
    </label>
  );
}
