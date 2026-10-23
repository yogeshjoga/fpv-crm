import { useState } from 'react';
import { AlertTriangle, Box, CheckCircle2, ExternalLink, Monitor, Smartphone } from 'lucide-react';
import { SHOP_URL, categoryName, formatINR, PRODUCT_TAGS } from '../../../lib/shop';

/**
 * A live picture of how a product appears on the online store, built from what is on screen in the editor
 * (saved or not). Photos, prices, stock wording and the order of the sections follow the store; the "Real store" tab
 * shows the store itself for products that are saved and live.
 */
export interface PreviewProduct {
  name: string;
  brand: string;
  category: string;
  slug: string;
  price: number | null;
  mrp: number | null;
  stock: number;
  lowStockAt: number;
  tags: string[];
  short: string;
  highlights: string[];
  specs: { key: string; value: string }[];
  inBox: string[];
  images: string[];
  art: string;
  variantName: string;
  variants: { label: string; price: number | null; mrp: number | null; stock: number }[];
  weightG: number | null;
  published: boolean;
  /** Official (brand-synced) products show the brand's own description under the specs on the store. */
  hasOfficialDescription?: boolean;
}

type Layout = 'desktop' | 'phone';

const TAG_STYLE: Record<string, string> = {
  hot: 'bg-red-600 text-white',
  new: 'bg-blue-600 text-white',
  bestseller: 'bg-amber-500 text-white',
  'made-in-india': 'bg-emerald-600 text-white',
};
const tagLabel = (k: string) => PRODUCT_TAGS.find((t) => t.key === k)?.label ?? k;

function derive(p: PreviewProduct) {
  const vs = p.variantName.trim() ? p.variants.filter((v) => v.label.trim()) : [];
  const priced = vs.filter((v) => v.price && v.price > 0);
  const cheapest = priced.length ? priced.reduce((a, b) => ((b.price as number) < (a.price as number) ? b : a)) : null;
  const price = vs.length ? cheapest?.price ?? null : p.price;
  const mrp = vs.length ? cheapest?.mrp ?? null : p.mrp;
  const stock = vs.length ? vs.reduce((n, v) => n + (Number.isFinite(v.stock) ? v.stock : 0), 0) : p.stock;
  const discount = price && mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const state: 'out' | 'low' | 'in' = stock <= 0 ? 'out' : stock <= p.lowStockAt ? 'low' : 'in';
  return { vs, price, mrp, stock, discount, state, from: vs.length > 1 };
}

function Photo({ src, art, className = '' }: { src?: string | null; art: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-white ${className}`}>
      {src ? (
        <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain p-3" />
      ) : (
        <div className="flex flex-col items-center gap-1 text-neutral-300">
          <Box size={36} />
          <span className="text-[11px]">{art} illustration</span>
        </div>
      )}
    </div>
  );
}

/** One tile of the store's product grid. */
export function StoreCard({ p, highlight = false }: { p: PreviewProduct; highlight?: boolean }) {
  const d = derive(p);
  const tag = p.tags[0];
  return (
    <div className={`relative flex w-full flex-col overflow-hidden rounded-2xl border bg-white text-left ${highlight ? 'border-blue-500 ring-2 ring-blue-200' : 'border-neutral-200'}`}>
      <div className="relative">
        <Photo src={p.images[0]} art={p.art} className="aspect-square w-full" />
        {tag && <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TAG_STYLE[tag] ?? 'bg-neutral-800 text-white'}`}>{tagLabel(tag)}</span>}
        {d.discount > 0 && <span className="absolute right-2 top-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">-{d.discount}%</span>}
        {d.state === 'out' && <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-neutral-700">Out of stock</div>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{p.brand.trim() || 'Brand'}</p>
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 text-neutral-900">{p.name.trim() || 'Product name'}</p>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-semibold tabular-nums text-neutral-900">
            {d.price ? `${d.from ? 'From ' : ''}${formatINR(d.price)}` : <span className="text-red-600">No price</span>}
          </span>
          {d.mrp && d.price && d.mrp > d.price && <span className="text-xs tabular-nums text-neutral-400 line-through">{formatINR(d.mrp)}</span>}
        </div>
        {d.state === 'low' && <p className="text-[11px] font-medium text-amber-600">Only {d.stock} left</p>}
        <span className="mt-1 rounded-full bg-neutral-900 py-1.5 text-center text-xs font-medium text-white">Add to cart</span>
      </div>
    </div>
  );
}

/** The product page. `layout` stands in for the screen width, because the editor itself is narrower than a real browser. */
export function StorePage({ p, layout }: { p: PreviewProduct; layout: Layout }) {
  const d = derive(p);
  const [picked, setPicked] = useState(0);
  const [option, setOption] = useState(0);
  const shown = p.images[Math.min(picked, Math.max(p.images.length - 1, 0))];
  const chosen = d.vs[Math.min(option, Math.max(d.vs.length - 1, 0))];
  const price = chosen?.price || d.price;
  const mrp = chosen ? chosen.mrp : d.mrp;
  const stock = chosen ? chosen.stock : d.stock;
  const state: 'out' | 'low' | 'in' = stock <= 0 ? 'out' : stock <= p.lowStockAt ? 'low' : 'in';
  const save = price && mrp && mrp > price ? mrp - price : 0;
  const wide = layout === 'desktop';
  const specs = p.specs.filter((s) => s.key.trim() && s.value.trim());
  const highlights = p.highlights.map((h) => h.trim()).filter(Boolean);
  const inBox = p.inBox.map((h) => h.trim()).filter(Boolean);

  return (
    <div className={`bg-white text-neutral-900 ${wide ? 'p-8' : 'p-4'}`}>
      <p className="mb-4 text-xs text-neutral-500">Home / {categoryName.get(p.category) ?? 'Category'} / <span className="text-neutral-800">{p.name.trim() || 'Product name'}</span></p>
      <div className={wide ? 'grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-10' : 'space-y-5'}>
        <div>
          <Photo src={shown} art={p.art} className="aspect-square w-full rounded-2xl border border-neutral-200" />
          {p.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {p.images.map((src, i) => (
                <button key={src + i} type="button" onClick={() => setPicked(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white ${i === picked ? 'border-neutral-900' : 'border-neutral-200'}`}>
                  <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{p.brand.trim() || 'Brand'}</p>
          <h3 className={`mt-1 font-semibold leading-tight ${wide ? 'text-3xl' : 'text-xl'}`}>{p.name.trim() || 'Product name'}</h3>
          {p.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.tags.map((t) => <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TAG_STYLE[t] ?? 'bg-neutral-800 text-white'}`}>{tagLabel(t)}</span>)}
            </div>
          )}
          {p.short.trim() && <p className="mt-3 text-sm leading-6 text-neutral-600">{p.short.trim()}</p>}

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`font-semibold tabular-nums ${wide ? 'text-3xl' : 'text-2xl'}`}>{price ? formatINR(price) : <span className="text-red-600">No price</span>}</span>
            {mrp && price && mrp > price && <span className="text-base tabular-nums text-neutral-400 line-through">{formatINR(mrp)}</span>}
            {save > 0 && <span className="text-sm font-medium text-emerald-700">You save {formatINR(save)}</span>}
          </div>
          <p className="mt-1 text-xs text-neutral-500">Inclusive of GST. Shipping is worked out at checkout.</p>

          {d.vs.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">{p.variantName.trim()}: <span className="font-normal text-neutral-600">{chosen?.label}</span></p>
              <div className="flex flex-wrap gap-2">
                {d.vs.map((v, i) => (
                  <button key={v.label + i} type="button" onClick={() => setOption(i)} className={`rounded-xl border px-3 py-1.5 text-sm ${i === option ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-800'} ${v.stock <= 0 ? 'opacity-50' : ''}`}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className={`mt-4 text-sm font-medium ${state === 'out' ? 'text-red-600' : state === 'low' ? 'text-amber-600' : 'text-emerald-700'}`}>
            {state === 'out' ? 'Out of stock' : state === 'low' ? `Only ${stock} left in stock` : 'In stock'}
          </p>
          <div className="mt-4 flex gap-2">
            <span className={`flex-1 rounded-full py-3 text-center text-sm font-medium ${state === 'out' ? 'bg-neutral-200 text-neutral-500' : 'bg-neutral-900 text-white'}`}>{state === 'out' ? 'Notify me' : 'Add to cart'}</span>
            {state !== 'out' && <span className="flex-1 rounded-full border border-neutral-900 py-3 text-center text-sm font-medium">Buy now</span>}
          </div>

          {highlights.length > 0 && (
            <ul className="mt-6 space-y-1.5 text-sm text-neutral-700">
              {highlights.map((h, i) => <li key={i} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />{h}</li>)}
            </ul>
          )}
        </div>
      </div>

      {(specs.length > 0 || inBox.length > 0 || p.weightG || p.hasOfficialDescription) && (
        <div className={`mt-8 border-t border-neutral-200 pt-6 ${wide ? 'grid grid-cols-2 gap-10' : 'space-y-6'}`}>
          {(specs.length > 0 || p.weightG) && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Specifications</h4>
              <dl className="divide-y divide-neutral-100 text-sm">
                {specs.map((s, i) => <div key={i} className="flex justify-between gap-4 py-2"><dt className="text-neutral-500">{s.key}</dt><dd className="text-right">{s.value}</dd></div>)}
                {p.weightG ? <div className="flex justify-between gap-4 py-2"><dt className="text-neutral-500">Weight</dt><dd>{p.weightG} g</dd></div> : null}
              </dl>
            </div>
          )}
          {inBox.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">In the box</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">{inBox.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </div>
          )}
          {p.hasOfficialDescription && (
            <div className="col-span-full">
              <h4 className="mb-2 text-sm font-semibold">Description</h4>
              <p className="text-sm text-neutral-500">The brand’s official description is shown here on the store.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** What the store would be missing, in plain words. */
export function previewChecks(p: PreviewProduct): { ok: boolean; text: string }[] {
  const d = derive(p);
  return [
    { ok: !!p.name.trim(), text: 'Has a name' },
    { ok: !!d.price, text: 'Has a price' },
    { ok: p.images.length > 0, text: 'Has a photo' },
    { ok: !!categoryName.get(p.category), text: 'Has a category' },
    { ok: p.short.trim().length >= 20, text: 'Short description under the title' },
    { ok: p.highlights.filter((h) => h.trim()).length >= 3, text: 'At least 3 highlights' },
    { ok: p.specs.filter((s) => s.key.trim() && s.value.trim()).length >= 3, text: 'At least 3 specifications' },
    { ok: d.state !== 'out', text: d.state === 'out' ? 'In stock (it shows “Out of stock” now)' : 'In stock' },
    { ok: p.published, text: p.published ? 'Visible on the store' : 'Hidden: customers will not see it' },
  ];
}

/** The full preview: grid tile, product page (desktop or phone), and the real store. */
export function PreviewPanel({ p, canShowReal }: { p: PreviewProduct; canShowReal: boolean }) {
  const [tab, setTab] = useState<'card' | 'page' | 'real'>('page');
  const [layout, setLayout] = useState<Layout>('desktop');
  const [reload, setReload] = useState(0);
  const checks = previewChecks(p);
  const realUrl = `${SHOP_URL}/product/${encodeURIComponent(p.slug)}`;
  const tabs = [
    { key: 'page', label: 'Product page' },
    { key: 'card', label: 'In the grid' },
    { key: 'real', label: 'Real store' },
  ] as const;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-black/5 p-1 text-sm">
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`rounded-full px-3 py-1 ${tab === t.key ? 'bg-white font-medium shadow-sm' : 'text-neutral-600'}`}>{t.label}</button>
          ))}
        </div>
        {tab !== 'real' && (
          <div className="inline-flex rounded-full bg-black/5 p-1 text-sm">
            <button type="button" onClick={() => setLayout('desktop')} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${layout === 'desktop' ? 'bg-white font-medium shadow-sm' : 'text-neutral-600'}`}><Monitor size={14} /> Computer</button>
            <button type="button" onClick={() => setLayout('phone')} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${layout === 'phone' ? 'bg-white font-medium shadow-sm' : 'text-neutral-600'}`}><Smartphone size={14} /> Phone</button>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          {tab === 'real' ? (
            canShowReal ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-neutral-500">
                  <span>The store as customers see it right now (last saved version; the store updates about a minute after saving).</span>
                  <span className="flex shrink-0 gap-3">
                    <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => setReload((n) => n + 1)}>Reload</button>
                    <a href={realUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">Open <ExternalLink size={12} /></a>
                  </span>
                </div>
                <iframe key={reload} title="The real store" src={realUrl} sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="no-referrer" className="h-[70vh] w-full rounded-2xl border border-neutral-200 bg-white" />
                <p className="mt-2 text-xs text-neutral-500">If this stays blank, the store does not allow being shown inside another page. Use “Open” to see it in a new tab.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-8 text-center text-sm text-neutral-500">
                The real store can show this product once it is saved and set to “Show on the store”. Use the other tabs to see it before then.
              </div>
            )
          ) : layout === 'phone' ? (
            <div className="mx-auto w-[375px] max-w-full overflow-hidden rounded-[2.25rem] border-[10px] border-neutral-900 bg-white">
              <div className="max-h-[70vh] overflow-y-auto">
                {tab === 'page' ? <StorePage p={p} layout="phone" /> : (
                  <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-3"><StoreCard p={p} highlight /><GhostCard /><GhostCard /><GhostCard /></div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white">
              {tab === 'page' ? <StorePage p={p} layout="desktop" /> : (
                <div className="grid grid-cols-4 gap-4 bg-neutral-50 p-6"><StoreCard p={p} highlight /><GhostCard /><GhostCard /><GhostCard /></div>
              )}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-white/70 bg-white/60 p-4 text-sm">
          <p className="mb-2 font-medium text-neutral-900">Before you publish</p>
          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.text} className={`flex items-start gap-2 ${c.ok ? 'text-neutral-600' : 'text-amber-700'}`}>
                {c.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
                {c.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-500">This preview updates as you type. Nothing is saved or shown to customers until you press Save.</p>
        </aside>
      </div>
    </div>
  );
}

function GhostCard() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 opacity-60">
      <div className="aspect-square rounded-xl bg-neutral-100" />
      <div className="mt-3 h-3 w-1/3 rounded bg-neutral-100" />
      <div className="mt-2 h-4 w-4/5 rounded bg-neutral-100" />
      <div className="mt-3 h-4 w-1/2 rounded bg-neutral-100" />
    </div>
  );
}
