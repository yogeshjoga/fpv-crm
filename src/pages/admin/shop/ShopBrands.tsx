import { useState } from 'react';
import { useQuery } from '../../../lib/useQuery';
import { brandSlug, run, shopDb, storeAsset, uploadShopImage } from '../../../lib/shop';
import { Button, Field, PageHeader, Spinner, TextInput, useToast } from '../../../components/ui/kit';
import { GlassCard } from '../../../components/ui/shared';

interface BrandRow { slug: string; name: string; count: number; logoUrl: string | null; logoWidth: number | null; logoHeight: number | null; website: string }

async function load() {
  // Count products per brand, paging past the API's 1,000-row limit.
  const names: string[] = [];
  for (let from = 0; ; from += 1000) {
    const data = (await run(shopDb.from('shop_products').select('brand').order('id').range(from, from + 999))) as { brand: string }[];
    names.push(...data.map((d) => d.brand));
    if (data.length < 1000) break;
  }
  type Saved = { slug: string; logo_url: string | null; logo_width: number | null; logo_height: number | null; website: string | null };
  const saved = (await run(shopDb.from('shop_brands').select('slug, logo_url, logo_width, logo_height, website'))) as Saved[];
  const counts = new Map<string, { name: string; count: number }>();
  for (const n of names) {
    const slug = brandSlug(n);
    const cur = counts.get(slug);
    counts.set(slug, { name: cur?.name ?? n, count: (cur?.count ?? 0) + 1 });
  }
  const bySlug = new Map(saved.map((b) => [b.slug, b]));
  return [...counts.entries()]
    .map(([slug, { name, count }]): BrandRow => {
      const b = bySlug.get(slug);
      return { slug, name, count, logoUrl: b?.logo_url ?? null, logoWidth: b?.logo_width ?? null, logoHeight: b?.logo_height ?? null, website: b?.website ?? '' };
    })
    .sort((a, b) => Number(Boolean(a.logoUrl)) - Number(Boolean(b.logoUrl)) || a.name.localeCompare(b.name));
}

export function ShopBrands() {
  const q = useQuery(load, []);
  const rows = q.data ?? [];
  const missing = rows.filter((r) => !r.logoUrl).length;
  return (
    <div>
      <PageHeader title="Brands" subtitle="Logos appear on the store’s Brands page, brand pages, product pages and home page. Use official logo files, ideally a transparent PNG." />
      {q.loading && !q.data ? (
        <Spinner />
      ) : q.error ? (
        <p className="text-sm text-red-600">Couldn’t load brands: {q.error}</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-neutral-500">
            {missing ? `${missing} of ${rows.length} brands have no logo yet and show their name instead. They’re listed first.` : `All ${rows.length} brands have a logo.`}
          </p>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => <BrandCard key={r.slug} row={r} />)}
          </ul>
        </>
      )}
    </div>
  );
}

/** Sizes a logo by visual area so wide wordmarks and compact marks carry the same weight. */
function Logo({ name, url, width, height }: { name: string; url: string | null; width: number | null; height: number | null }) {
  const src = storeAsset(url);
  if (!src) return <span className="text-lg font-semibold text-neutral-800">{name}</span>;
  const ratio = width && height ? width / height : 3;
  let h = Math.sqrt(3400 / ratio);
  let w = h * ratio;
  if (h > 48) { h = 48; w = h * ratio; }
  if (w > 150) { w = 150; h = w / ratio; }
  return <img src={src} alt={`${name} logo`} style={{ width: Math.round(w), height: Math.round(h) }} className="object-contain" />;
}

function BrandCard({ row }: { row: BrandRow }) {
  const toast = useToast();
  const [saved, setSaved] = useState({ logo: row.logoUrl, website: row.website });
  const [logo, setLogo] = useState(row.logoUrl);
  const [size, setSize] = useState({ w: row.logoWidth, h: row.logoHeight });
  const [website, setWebsite] = useState(row.website);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = logo !== saved.logo || website !== saved.website;

  async function upload(file: File) {
    setUploading(true);
    try {
      // The intrinsic size lets the store give every logo the same visual weight.
      const bmp = await createImageBitmap(file).catch(() => null);
      const dims = bmp ? { w: bmp.width, h: bmp.height } : { w: null, h: null };
      bmp?.close();
      setLogo(await uploadShopImage(file, 'shop/brands', 1024 * 1024));
      setSize(dims);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const site = website.trim();
    if (site && !/^https:\/\//.test(site)) return toast('The website must start with https://', 'error');
    setSaving(true);
    try {
      await run(
        shopDb.from('shop_brands').upsert(
          {
            slug: row.slug,
            name: row.name,
            logo_url: logo,
            logo_width: logo && size.w ? Math.round(size.w) : null,
            logo_height: logo && size.h ? Math.round(size.h) : null,
            website: site || null,
            ...(logo?.startsWith('https://') && logo !== saved.logo ? { logo_source: 'Uploaded in CRM' } : {}),
          },
          { onConflict: 'slug' },
        ),
      );
      setSaved({ logo, website });
      toast(`${row.name} saved. The store updates within a minute.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <li>
      <GlassCard className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-neutral-900">{row.name}</p>
          <p className="text-xs tabular-nums text-neutral-500">{row.count} {row.count === 1 ? 'product' : 'products'}</p>
        </div>
        <div className="mt-3 flex h-24 items-center justify-center rounded-2xl border border-black/5 bg-white px-4">
          <Logo name={row.name} url={logo} width={size.w} height={size.h} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="cursor-pointer rounded-full bg-white/70 px-4 py-1.5 font-medium shadow-sm hover:bg-white">
            {uploading ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}
            <input type="file" accept="image/png,image/webp,image/jpeg" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {logo && <button type="button" onClick={() => setLogo(null)} className="text-neutral-500 hover:text-red-600">Remove logo</button>}
        </div>
        <div className="mt-3">
          <Field label="Official website"><TextInput value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></Field>
        </div>
        {dirty && <Button type="button" loading={saving} disabled={uploading} onClick={save} className="mt-3 w-full">Save brand</Button>}
      </GlassCard>
    </li>
  );
}
