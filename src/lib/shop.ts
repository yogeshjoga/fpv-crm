import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * The online store's tables (shop_*) live in this same database but aren't in the generated
 * Database types, so shop pages use an untyped view of the same signed-in client. Row-level
 * security still applies: only staff with `shop` write access (admins, super admins) can change it.
 */
export const shopDb = supabase as unknown as SupabaseClient;

/** Public store address, for "View on store" links and the store's own logo files. */
export const SHOP_URL = (import.meta.env.VITE_SHOP_URL as string | undefined) || 'https://shop.egirerobotics.com';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const formatINR = (n: number) => inr.format(n);
/** GST included in a tax-inclusive price (18% for drone parts). */
export const gstIncluded = (total: number, rate = 0.18) => Math.round(total - total / (1 + rate));

/** Store image paths like /brands/dji.png are served by the store, not the CRM. */
export const storeAsset = (url: string | null | undefined) => (url ? (url.startsWith('/') ? `${SHOP_URL}${url}` : url) : null);

export const brandSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** Turns database errors into messages an admin can act on. */
export function shopError(e: unknown): string {
  const msg = e instanceof Error ? e.message : ((e as { message?: string })?.message ?? String(e));
  if (/duplicate key.*slug/i.test(msg)) return 'Another product already uses this URL slug. Change the slug.';
  if (/duplicate key.*sku/i.test(msg)) return 'Another product already uses this SKU.';
  if (/row-level security|permission denied/i.test(msg)) return 'You don’t have permission to change the shop.';
  if (/publish_needs_price/.test(msg)) return 'Set a price before showing this product on the store.';
  if (/price_before_stock/.test(msg)) return 'Set a price before adding stock.';
  if (/official sync/i.test(msg)) return 'Official product details come from the brand and can’t be edited here.';
  return msg;
}

/** Throws a readable error when a Supabase call fails. */
export async function run<T = unknown>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(shopError(error));
  return data;
}

export const toInt = (v: unknown) => {
  const n = Math.round(Number(v));
  if (v === '' || !Number.isFinite(n) || n < 0) throw new Error('Prices and stock must be whole numbers of 0 or more.');
  return n;
};
export const optInt = (v: unknown) => (v === '' || v === null || v === undefined ? null : toInt(v));
export const digits = (s: string) => s.replace(/\D/g, '');

/** Uploads a product or logo image to the public site-media bucket and returns its URL. */
export async function uploadShopImage(file: File, folder: string, maxBytes = 3 * 1024 * 1024) {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Upload a PNG, JPG or WebP image.');
  if (file.size > maxBytes) throw new Error(`Images must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`);
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('site-media').upload(path, file, { cacheControl: '31536000', contentType: file.type });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl;
}

export const PRODUCT_TAGS = [
  { key: 'hot', label: 'Hot deal' },
  { key: 'new', label: 'New arrival' },
  { key: 'bestseller', label: 'Bestseller' },
  { key: 'made-in-india', label: 'Made in India' },
];

export const ARTS = ['quad', 'whoop', 'wing', 'camdrone', 'goggles', 'airunit', 'fpvcam', 'antenna', 'frame', 'motor', 'esc', 'board', 'prop', 'gps', 'radio', 'receiver', 'battery', 'charger', 'cable', 'actioncam', 'gimbal', 'meter', 'iron', 'tool', 'bag'];

export const ORDER_STATUS: Record<string, { label: string; tone: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }> = {
  awaiting_payment: { label: 'Awaiting payment', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'neutral' },
  packed: { label: 'Packed', tone: 'amber' },
  shipped: { label: 'Shipped', tone: 'blue' },
  delivered: { label: 'Delivered', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  pending: { label: 'Payment pending', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

// Same departments and categories as the store (src/data/categories.ts in the shop repo).
export const DEPARTMENTS = [
  { slug: 'drones', name: 'Drones' },
  { slug: 'fpv', name: 'FPV systems' },
  { slug: 'parts', name: 'Build parts' },
  { slug: 'radio', name: 'Radio & links' },
  { slug: 'power', name: 'Power' },
  { slug: 'cameras', name: 'Cameras & gimbals' },
  { slug: 'electronics', name: 'Electronics' },
  { slug: 'tools', name: 'Tools & gear' },
  { slug: 'printing', name: 'Printing service' },
];

export const CATEGORIES = [
  { slug: 'fpv-drones', name: 'FPV drones', department: 'drones' },
  { slug: 'whoops-micro', name: 'Whoops & micro', department: 'drones' },
  { slug: 'camera-drones', name: 'Camera drones', department: 'drones' },
  { slug: 'vtol-fixed-wing', name: 'VTOL & fixed wing', department: 'drones' },
  { slug: 'industrial-drones', name: 'Industrial & agri', department: 'drones' },
  { slug: 'goggles', name: 'FPV goggles', department: 'fpv' },
  { slug: 'air-units', name: 'Air units & VTX', department: 'fpv' },
  { slug: 'fpv-cameras', name: 'FPV cameras', department: 'fpv' },
  { slug: 'antennas', name: 'Antennas', department: 'fpv' },
  { slug: 'frames', name: 'Frames', department: 'parts' },
  { slug: 'motors', name: 'Motors', department: 'parts' },
  { slug: 'escs', name: 'ESCs', department: 'parts' },
  { slug: 'flight-controllers', name: 'Flight controllers', department: 'parts' },
  { slug: 'propellers', name: 'Propellers', department: 'parts' },
  { slug: 'gps-sensors', name: 'GPS & sensors', department: 'parts' },
  { slug: 'accessories', name: 'Accessories & spares', department: 'parts' },
  { slug: 'radios', name: 'Radio controllers', department: 'radio' },
  { slug: 'receivers', name: 'Receivers', department: 'radio' },
  { slug: 'long-range', name: 'Telemetry & long range', department: 'radio' },
  { slug: 'batteries', name: 'Batteries', department: 'power' },
  { slug: 'chargers', name: 'Chargers', department: 'power' },
  { slug: 'power-modules', name: 'BECs & power', department: 'power' },
  { slug: 'cables-connectors', name: 'Cables & connectors', department: 'power' },
  { slug: 'action-cameras', name: 'Action cameras', department: 'cameras' },
  { slug: 'gimbal-cameras', name: 'Gimbal & thermal', department: 'cameras' },
  { slug: 'dev-boards', name: 'Dev boards', department: 'electronics' },
  { slug: 'sensors-modules', name: 'Sensors & modules', department: 'electronics' },
  { slug: 'lab-equipment', name: 'Lab equipment', department: 'electronics' },
  { slug: 'soldering', name: 'Soldering', department: 'tools' },
  { slug: 'hand-tools', name: 'Hand tools', department: 'tools' },
  { slug: 'bags-cases', name: 'Bags & cases', department: 'tools' },
  { slug: 'gps-supports', name: 'GPS supports', department: 'printing' },
  { slug: 'battery-supports', name: 'Battery supports', department: 'printing' },
  { slug: 'prop-guards', name: 'Prop guards', department: 'printing' },
  { slug: 'ball-frames', name: 'Ball frame prints', department: 'printing' },
  { slug: 'printed-cases', name: 'Cases', department: 'printing' },
];
export const categoryName = new Map(CATEGORIES.map((c) => [c.slug, c.name]));
