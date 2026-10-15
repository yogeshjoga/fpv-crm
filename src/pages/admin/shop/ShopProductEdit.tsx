import { useState } from 'react';
import type React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, X } from 'lucide-react';
import { useQuery } from '../../../lib/useQuery';
import {
  ARTS, PRODUCT_TAGS, SHOP_URL, categoryName, digits, optInt, run, shopDb, slugify, toInt, uploadShopImage,
} from '../../../lib/shop';
import { Badge, Button, Checkbox, Field, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../../components/ui/kit';
import { CategorySelect, Panel, Thumb } from './ShopUi';

interface Variant { id: string; label: string; sku: string | null; price: number; mrp: number | null; stock: number; sort: number }
interface Product {
  id: string; sku: string; slug: string; name: string; brand: string; category: string; price: number; mrp: number | null;
  stock: number; low_stock_at: number; art: string; tags: string[]; short: string; highlights: string[];
  specs: Record<string, string> | null; in_box: string[] | null; image_url: string | null; images: string[] | null;
  weight_g: number | null; is_published: boolean; variant_name: string | null; source: string;
  source_url: string | null; source_price: number | string | null; source_currency: string | null; source_synced_at: string | null;
  description_html: string | null; updated_at: string; shop_product_variants: Variant[];
}

const BackLink = () => (
  <Link to="/admin/shop/products" className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
    <ArrowLeft size={14} /> Products & stock
  </Link>
);

export function ShopProductEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const q = useQuery(
    async () => (isNew ? null : ((await run(shopDb.from('shop_products').select('*, shop_product_variants(id, label, sku, price, mrp, stock, sort)').eq('id', id).maybeSingle())) as Product | null)),
    [id],
  );

  if (isNew) {
    return (
      <div>
        <BackLink />
        <PageHeader title="Add product" subtitle="It goes live on the store as soon as you save, unless you untick “Show on the store”." />
        <ManualForm initial={blankManual} />
      </div>
    );
  }
  if (q.loading && !q.data) return <Spinner />;
  if (q.error) return <p className="text-sm text-red-600">Couldn’t load this product: {q.error}</p>;
  const p = q.data;
  if (!p) {
    return (
      <div>
        <BackLink />
        <p className="text-sm text-neutral-600">This product doesn’t exist any more.</p>
      </div>
    );
  }
  const variants = [...(p.shop_product_variants ?? [])].sort((a, b) => a.sort - b.sort);
  const viewOnStore = p.is_published && (
    <a href={`${SHOP_URL}/product/${p.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-sm text-neutral-700 shadow-sm hover:bg-white">
      View on store <ExternalLink size={14} />
    </a>
  );

  return (
    <div>
      <BackLink />
      <PageHeader title={p.name} subtitle={`${p.brand}, SKU ${p.sku}${p.is_published ? '' : ', hidden draft'}`} actions={viewOnStore} />
      {p.source !== 'manual' ? (
        <OfficialForm key={p.updated_at} p={p} variants={variants} onSaved={q.refetch} />
      ) : (
        <ManualForm
          key={p.updated_at}
          onSaved={q.refetch}
          initial={{
            id: p.id, sku: p.sku, slug: p.slug, name: p.name, brand: p.brand, category: p.category,
            price: String(p.price), mrp: p.mrp == null ? '' : String(p.mrp), stock: String(p.stock), low_stock_at: String(p.low_stock_at),
            art: p.art, tags: p.tags ?? [], short: p.short ?? '', highlights: p.highlights?.length ? p.highlights : [''],
            specs: Object.entries(p.specs ?? {}).map(([key, value]) => ({ key, value })),
            in_box: p.in_box ?? [], image_url: p.image_url, weight_g: p.weight_g == null ? '' : String(p.weight_g), is_published: p.is_published,
            variant_name: p.variant_name ?? '',
            variants: variants.map((v) => ({ id: v.id, label: v.label, price: String(v.price), mrp: v.mrp == null ? '' : String(v.mrp), stock: String(v.stock) })),
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── Official (brand-synced) products: commercial fields only ─── */

type OfficialVariantEdit = { id: string; price: string; mrp: string; stock: string };

function OfficialForm({ p, variants, onSaved }: { p: Product; variants: Variant[]; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    category: p.category, short: p.short ?? '', tags: p.tags ?? [], low_stock_at: String(p.low_stock_at), is_published: p.is_published,
    image_url: p.image_url, price: String(p.price || ''), mrp: p.mrp == null ? '' : String(p.mrp), stock: String(p.stock),
  });
  const [vs, setVs] = useState<OfficialVariantEdit[]>(
    variants.map((v) => ({ id: v.id, price: String(v.price || ''), mrp: v.mrp == null ? '' : String(v.mrp), stock: String(v.stock) })),
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setError(null); setF((x) => ({ ...x, [k]: v })); };
  const setV = (id: string, patch: Partial<OfficialVariantEdit>) => setVs((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const images = p.images ?? [];
  const sourcePrice = p.source_price == null ? null : Number(p.source_price);
  const ref = sourcePrice ? `${p.source_currency === 'INR' ? '₹' : p.source_currency === 'USD' ? '$' : ''}${sourcePrice} ${p.source_currency ?? ''}` : null;

  async function upload(file: File) {
    setUploading(true);
    try {
      set('image_url', await uploadShopImage(file, 'shop'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      for (const v of vs) {
        const price = toInt(v.price || '0');
        const stock = toInt(v.stock || '0');
        if (price === 0 && stock > 0) throw new Error('Set a price before adding stock.');
        await run(shopDb.from('shop_product_variants').update({ price, mrp: optInt(v.mrp), stock }).eq('id', v.id));
      }
      const row: Record<string, unknown> = {
        category: f.category, short: f.short.trim().slice(0, 300), tags: f.tags, low_stock_at: toInt(f.low_stock_at || '0'), image_url: f.image_url,
      };
      if (vs.length) {
        const priced = vs.map((v) => toInt(v.price || '0')).filter((n) => n > 0);
        row.price = priced.length ? Math.min(...priced) : 0;
      } else {
        row.price = toInt(f.price || '0');
        row.mrp = optInt(f.mrp);
        row.stock = toInt(f.stock || '0');
        if (row.price === 0 && (row.stock as number) > 0) throw new Error('Set a price before adding stock.');
      }
      if (f.is_published && !row.price) throw new Error('Set a price before showing this product on the store.');
      row.is_published = f.is_published;
      await run(shopDb.from('shop_products').update(row).eq('id', p.id));
      toast(f.is_published ? 'Saved. It’s live on the store within a minute.' : 'Saved as a hidden draft.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Panel title="Price & stock" action={ref && <span className="text-sm text-neutral-500">Brand’s list price: <b className="tabular-nums text-neutral-900">{ref}</b></span>}>
          <p className="-mt-1 text-sm text-neutral-500">Prices are in ₹ including GST. Options without a price stay hidden from customers.</p>
          {vs.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-neutral-500">
                  <tr><th className="pb-2 font-medium">{p.variant_name ?? 'Option'}</th><th className="pb-2 font-medium">Price ₹</th><th className="pb-2 font-medium">MRP ₹</th><th className="pb-2 font-medium">Stock</th></tr>
                </thead>
                <tbody>
                  {vs.map((v) => {
                    const meta = variants.find((x) => x.id === v.id)!;
                    return (
                      <tr key={v.id} className="border-t border-black/5">
                        <td className="py-2 pr-3">
                          <span className="block">{meta.label}</span>
                          {meta.sku && <span className="text-xs text-neutral-500">SKU {meta.sku}</span>}
                        </td>
                        <td className="py-2 pr-2"><TextInput aria-label={`Price for ${meta.label}`} inputMode="numeric" value={v.price} onChange={(e) => setV(v.id, { price: digits(e.target.value) })} className="w-28" /></td>
                        <td className="py-2 pr-2"><TextInput aria-label={`MRP for ${meta.label}`} inputMode="numeric" value={v.mrp} onChange={(e) => setV(v.id, { mrp: digits(e.target.value) })} className="w-28" /></td>
                        <td className="py-2"><TextInput aria-label={`Stock for ${meta.label}`} inputMode="numeric" value={v.stock} onChange={(e) => setV(v.id, { stock: digits(e.target.value) })} className="w-20" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Price ₹"><TextInput inputMode="numeric" value={f.price} onChange={(e) => set('price', digits(e.target.value))} /></Field>
              <Field label="MRP ₹" hint="Optional"><TextInput inputMode="numeric" value={f.mrp} onChange={(e) => set('mrp', digits(e.target.value))} /></Field>
              <Field label="Stock"><TextInput inputMode="numeric" value={f.stock} onChange={(e) => set('stock', digits(e.target.value))} /></Field>
            </div>
          )}
          <div className="mt-4 max-w-[200px]">
            <Field label="Low-stock alert at"><TextInput inputMode="numeric" value={f.low_stock_at} onChange={(e) => set('low_stock_at', digits(e.target.value))} /></Field>
          </div>
        </Panel>

        <Panel title="Store summary">
          <p className="-mt-1 mb-3 text-sm text-neutral-500">Shown under the product name. Edit it for your customers; the official description below stays as the brand wrote it.</p>
          <TextArea value={f.short} onChange={(e) => set('short', e.target.value)} maxLength={300} rows={3} />
          <p className="mt-1 text-right text-xs tabular-nums text-neutral-500">{f.short.length}/300</p>
        </Panel>

        <Panel title="Official content" action={<Badge tone="blue">From {p.brand}, read-only</Badge>}>
          <p className="-mt-1 text-sm text-neutral-500">
            Name, photos, description and options come from the brand and refresh on every sync
            {p.source_synced_at ? ` (last ${new Date(p.source_synced_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}.
            {p.source_url && <> <a href={p.source_url} target="_blank" rel="noopener" className="text-blue-600 hover:underline">View on {p.brand}’s site</a></>}
          </p>
          {images.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {images.map((src) => <li key={src}><Thumb src={src} /></li>)}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm">
              <p className="font-medium text-neutral-900">{p.brand} doesn’t allow its photos to be shown on other websites.</p>
              <p className="mt-1 text-neutral-600">Upload a product photo from {p.brand}’s dealer media kit. It’s shown until the brand’s own photos become available.</p>
              <div className="mt-3 flex items-center gap-3">
                {f.image_url && <Thumb src={f.image_url} />}
                <label className="cursor-pointer rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-neutral-50">
                  {uploading ? 'Uploading…' : f.image_url ? 'Replace photo' : 'Add photo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
                {f.image_url && <button type="button" onClick={() => set('image_url', null)} className="text-neutral-500 hover:text-red-600">Remove</button>}
              </div>
            </div>
          )}
          {p.description_html ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">Show official description</summary>
              {/* Sanitised with sanitize-html by the catalog sync before it's stored. */}
              <div className="shop-desc mt-3 max-h-[480px] overflow-y-auto rounded-2xl border border-black/5 bg-white/70 p-4 text-sm" dangerouslySetInnerHTML={{ __html: p.description_html }} />
            </details>
          ) : (
            <p className="mt-4 text-sm text-neutral-500">The brand doesn’t publish a description for this product.</p>
          )}
        </Panel>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
        <Panel>
          <Field label="Category"><CategorySelect value={f.category} onChange={(v) => set('category', v)} /></Field>
          <TagPicker tags={f.tags} onChange={(t) => set('tags', t)} />
          <div className="mt-4 border-t border-black/5 pt-4">
            <Checkbox label="Show on the store" checked={f.is_published} onChange={(e) => set('is_published', e.target.checked)} />
            <p className="mt-1 text-xs text-neutral-500">Needs a price first.</p>
          </div>
        </Panel>
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" loading={saving} disabled={uploading} className="w-full">Save changes</Button>
      </aside>
    </form>
  );
}

function TagPicker({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-medium text-neutral-700">Labels</p>
      <div className="space-y-1.5">
        {PRODUCT_TAGS.map((t) => (
          <Checkbox
            key={t.key}
            label={t.label}
            checked={tags.includes(t.key)}
            onChange={(e) => onChange(e.target.checked ? [...tags, t.key] : tags.filter((x) => x !== t.key))}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Products added by hand: everything is editable ─── */

interface ManualInput {
  id?: string; sku: string; slug: string; name: string; brand: string; category: string;
  price: string; mrp: string; stock: string; low_stock_at: string; art: string; tags: string[]; short: string;
  highlights: string[]; specs: { key: string; value: string }[]; in_box: string[]; image_url: string | null;
  weight_g: string; is_published: boolean; variant_name: string;
  variants: { id?: string; label: string; price: string; mrp: string; stock: string }[];
}

const blankManual: ManualInput = {
  sku: '', slug: '', name: '', brand: '', category: '', price: '', mrp: '', stock: '0', low_stock_at: '5',
  art: 'board', tags: ['new'], short: '', highlights: ['', '', ''], specs: [{ key: '', value: '' }], in_box: [],
  image_url: null, weight_g: '', is_published: true, variant_name: '', variants: [],
};

function ManualForm({ initial, onSaved }: { initial: ManualInput; onSaved?: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [p, setP] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const hasVariants = Boolean(p.variant_name.trim());
  const set = <K extends keyof ManualInput>(k: K, v: ManualInput[K]) => { setError(null); setP((x) => ({ ...x, [k]: v })); };

  async function upload(file: File) {
    setUploading(true);
    try {
      set('image_url', await uploadShopImage(file, 'shop'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const name = p.name.trim();
      if (name.length < 2) throw new Error('Enter a product name.');
      if (!categoryName.has(p.category)) throw new Error('Choose a category.');
      if (!p.brand.trim()) throw new Error('Enter the brand.');
      const variants = (hasVariants ? p.variants : []).filter((v) => v.label.trim());
      if (hasVariants && !variants.length) throw new Error('Add at least one option, or clear the option name.');
      if (new Set(variants.map((v) => v.label.trim().toLowerCase())).size !== variants.length) throw new Error('Option names must be unique.');

      const row = {
        sku: p.sku.trim() || `EG-${Date.now().toString().slice(-6)}`,
        slug: slugify(p.slug || name),
        name,
        brand: p.brand.trim(),
        category: p.category,
        price: variants.length ? Math.min(...variants.map((v) => toInt(v.price))) : toInt(p.price),
        mrp: optInt(p.mrp),
        stock: variants.length ? 0 : toInt(p.stock),
        low_stock_at: toInt(p.low_stock_at),
        art: p.art,
        tags: p.tags,
        short: p.short.trim(),
        highlights: p.highlights.map((h) => h.trim()).filter(Boolean),
        specs: Object.fromEntries(p.specs.filter((s) => s.key.trim() && s.value.trim()).map((s) => [s.key.trim(), s.value.trim()])),
        in_box: p.in_box.map((h) => h.trim()).filter(Boolean),
        image_url: p.image_url,
        weight_g: optInt(p.weight_g),
        is_published: p.is_published,
        variant_name: variants.length ? p.variant_name.trim() : null,
      };

      let id = p.id;
      if (id) {
        await run(shopDb.from('shop_products').update(row).eq('id', id));
      } else {
        id = ((await run(shopDb.from('shop_products').insert(row).select('id').single())) as { id: string }).id;
      }

      // Options: update kept ones, insert new ones, delete removed ones.
      const existing = (await run(shopDb.from('shop_product_variants').select('id').eq('product_id', id))) as { id: string }[];
      const keep = new Set(variants.filter((v) => v.id).map((v) => v.id));
      const removed = existing.map((v) => v.id).filter((vid) => !keep.has(vid));
      if (removed.length) await run(shopDb.from('shop_product_variants').delete().in('id', removed));
      for (const [i, v] of variants.entries()) {
        const vrow = { product_id: id, label: v.label.trim(), price: toInt(v.price), mrp: optInt(v.mrp), stock: toInt(v.stock), sort: i };
        await run(v.id ? shopDb.from('shop_product_variants').update(vrow).eq('id', v.id) : shopDb.from('shop_product_variants').insert(vrow));
      }

      if (!p.id) {
        toast(p.is_published ? 'Product added. It’s live on the store within a minute.' : 'Product added as a hidden draft.');
        navigate(`/admin/shop/products/${id}`, { replace: true });
      } else {
        toast('Saved. The store updates within a minute.');
        onSaved?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Panel title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Product name" required>
                <TextInput required value={p.name} onChange={(e) => { set('name', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} />
              </Field>
            </div>
            <Field label="Brand" required><TextInput required value={p.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
            <Field label="Category" required><CategorySelect value={p.category} onChange={(v) => set('category', v)} /></Field>
            <Field label="SKU" hint="Leave blank to create one"><TextInput value={p.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
            <Field label="URL slug" hint={`${SHOP_URL.replace('https://', '')}/product/${p.slug || '…'}`}>
              <TextInput required value={p.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Lowercase letters, numbers and dashes" onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Short description" hint="Shown under the title">
                <TextArea value={p.short} rows={2} maxLength={300} onChange={(e) => set('short', e.target.value)} />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title="Price & stock">
          <div className="grid gap-4 sm:grid-cols-3">
            {!hasVariants ? (
              <>
                <Field label="Price (₹, inc. GST)" required><TextInput required inputMode="numeric" value={p.price} onChange={(e) => set('price', digits(e.target.value))} /></Field>
                <Field label="MRP (₹)" hint="Optional"><TextInput inputMode="numeric" value={p.mrp} onChange={(e) => set('mrp', digits(e.target.value))} /></Field>
                <Field label="Stock" required><TextInput required inputMode="numeric" value={p.stock} onChange={(e) => set('stock', digits(e.target.value))} /></Field>
              </>
            ) : (
              <p className="text-sm text-neutral-500 sm:col-span-2">Price and stock are set per option below. The store shows the lowest option price.</p>
            )}
            <Field label="Low-stock alert at"><TextInput required inputMode="numeric" value={p.low_stock_at} onChange={(e) => set('low_stock_at', digits(e.target.value))} /></Field>
          </div>
        </Panel>

        <Panel title="Options">
          <p className="-mt-1 text-sm text-neutral-500">For products sold in versions (KV, colour, kit). Leave the option name blank for a simple product.</p>
          <div className="mt-3 max-w-xs">
            <Field label="Option name" hint="e.g. KV, Colour, Bundle"><TextInput value={p.variant_name} onChange={(e) => set('variant_name', e.target.value)} /></Field>
          </div>
          {hasVariants && (
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-[1fr_100px_100px_80px_32px] gap-2 text-xs text-neutral-500">
                <span>Option</span><span>Price ₹</span><span>MRP ₹</span><span>Stock</span><span />
              </div>
              {p.variants.map((v, i) => {
                const upd = (patch: Partial<typeof v>) => set('variants', p.variants.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div key={v.id ?? `new-${i}`} className="grid grid-cols-[1fr_100px_100px_80px_32px] items-center gap-2">
                    <TextInput aria-label="Option" required value={v.label} onChange={(e) => upd({ label: e.target.value })} />
                    <TextInput aria-label="Price" required inputMode="numeric" value={v.price} onChange={(e) => upd({ price: digits(e.target.value) })} />
                    <TextInput aria-label="MRP" inputMode="numeric" value={v.mrp} onChange={(e) => upd({ mrp: digits(e.target.value) })} />
                    <TextInput aria-label="Stock" required inputMode="numeric" value={v.stock} onChange={(e) => upd({ stock: digits(e.target.value) })} />
                    <button type="button" aria-label={`Remove ${v.label || 'option'}`} className="text-neutral-400 hover:text-red-600" onClick={() => set('variants', p.variants.filter((_, j) => j !== i))}><X size={16} /></button>
                  </div>
                );
              })}
              <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => set('variants', [...p.variants, { label: '', price: '', mrp: '', stock: '0' }])}>Add option</button>
            </div>
          )}
        </Panel>

        <Panel title="Details">
          <ListEditor label="Highlights" hint="3–5 short bullet points" items={p.highlights} onChange={(v) => set('highlights', v)} />
          <div className="mt-5">
            <p className="text-sm font-medium text-neutral-700">Specifications</p>
            <div className="mt-2 space-y-2">
              {p.specs.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.4fr_32px] items-center gap-2">
                  <TextInput aria-label="Spec name" placeholder="e.g. Weight" value={s.key} onChange={(e) => set('specs', p.specs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  <TextInput aria-label="Spec value" placeholder="e.g. 420 g" value={s.value} onChange={(e) => set('specs', p.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <button type="button" aria-label="Remove spec" className="text-neutral-400 hover:text-red-600" onClick={() => set('specs', p.specs.filter((_, j) => j !== i))}><X size={16} /></button>
                </div>
              ))}
              <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => set('specs', [...p.specs, { key: '', value: '' }])}>Add specification</button>
            </div>
          </div>
          <div className="mt-5">
            <ListEditor label="In the box" hint="Optional" items={p.in_box} onChange={(v) => set('in_box', v)} />
          </div>
        </Panel>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
        <Panel title="Photo">
          <Thumb src={p.image_url} alt={p.name} className="aspect-[4/3] w-full" />
          <label className="mt-3 block cursor-pointer rounded-full bg-white/70 py-2 text-center text-sm font-medium shadow-sm hover:bg-white">
            {uploading ? 'Uploading…' : p.image_url ? 'Replace photo' : 'Upload photo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {p.image_url ? (
            <button type="button" className="mt-2 w-full text-sm text-neutral-500 hover:text-red-600" onClick={() => set('image_url', null)}>Remove photo</button>
          ) : (
            <div className="mt-3">
              <Field label="Illustration when there’s no photo">
                <Select value={p.art} onChange={(e) => set('art', e.target.value)}>
                  {ARTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
              </Field>
            </div>
          )}
        </Panel>
        <Panel>
          <TagPicker tags={p.tags} onChange={(t) => set('tags', t)} />
          <div className="mt-4 border-t border-black/5 pt-4">
            <Checkbox label="Show on the store" checked={p.is_published} onChange={(e) => set('is_published', e.target.checked)} />
          </div>
        </Panel>
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" loading={saving} disabled={uploading} className="w-full">{p.id ? 'Save changes' : 'Add product'}</Button>
      </aside>
    </form>
  );
}

function ListEditor({ label, hint, items, onChange }: { label: string; hint?: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-700">{label} {hint && <span className="font-normal text-neutral-500">({hint})</span>}</p>
      <div className="mt-2 space-y-2">
        {items.map((h, i) => (
          <div key={i} className="grid grid-cols-[1fr_32px] items-center gap-2">
            <TextInput aria-label={`${label} ${i + 1}`} value={h} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" aria-label="Remove" className="text-neutral-400 hover:text-red-600" onClick={() => onChange(items.filter((_, j) => j !== i))}><X size={16} /></button>
          </div>
        ))}
        <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => onChange([...items, ''])}>Add line</button>
      </div>
    </div>
  );
}
