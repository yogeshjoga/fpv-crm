import { supabase } from './supabase';

const BUCKET = 'site-media';
// Three sizes of every photo so the website can fetch the smallest file that still looks sharp on the visitor's screen.
const FULL_EDGE = 2560;
const MEDIUM_EDGE = 1280;
const THUMB_EDGE = 800;
const FULL_TARGET_BYTES = 850_000;
const MEDIUM_TARGET_BYTES = 280_000;

export const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

interface Encoded {
  blob: Blob;
  width: number;
  height: number;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This browser could not convert the image'))), 'image/webp', quality),
  );
}

/** Scale an image so its longest edge is at most `maxEdge`, encoded as WebP. EXIF rotation is applied. */
async function encode(bitmap: ImageBitmap, maxEdge: number, quality: number, maxBytes?: number): Promise<Encoded> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not process the image');
  ctx.drawImage(bitmap, 0, 0, width, height);

  let q = quality;
  let blob = await toBlob(canvas, q);
  while (maxBytes && blob.size > maxBytes && q > 0.6) {
    q = Math.round((q - 0.05) * 100) / 100;
    blob = await toBlob(canvas, q);
  }
  return { blob, width, height };
}

async function open(file: File): Promise<ImageBitmap> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: only JPG, PNG or WebP images are supported`);
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

async function put(path: string, blob: Blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message);
}

export interface UploadedGalleryImage {
  full_path: string;
  medium_path: string;
  thumb_path: string;
  width: number;
  height: number;
}

/** Resize a photo to a full, a medium and a thumbnail WebP and upload all three under gallery/<albumId>/. Files never change, so they are cached for a year. */
export async function uploadGalleryImage(albumId: string, file: File): Promise<UploadedGalleryImage> {
  const bitmap = await open(file);
  try {
    const id = crypto.randomUUID();
    const full = await encode(bitmap, FULL_EDGE, 0.88, FULL_TARGET_BYTES);
    const medium = await encode(bitmap, MEDIUM_EDGE, 0.85, MEDIUM_TARGET_BYTES);
    const thumb = await encode(bitmap, THUMB_EDGE, 0.8);
    const full_path = `gallery/${albumId}/${id}.webp`;
    const medium_path = `gallery/${albumId}/${id}_m.webp`;
    const thumb_path = `gallery/${albumId}/${id}_t.webp`;
    const done: string[] = [];
    try {
      for (const [p, b] of [[full_path, full.blob], [medium_path, medium.blob], [thumb_path, thumb.blob]] as const) {
        await put(p, b);
        done.push(p);
      }
    } catch (e) {
      if (done.length) await supabase.storage.from(BUCKET).remove(done);
      throw e;
    }
    return { full_path, medium_path, thumb_path, width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}

/** Upload a blog cover (longest edge 1600px) under blog/ and return its storage path. */
export async function uploadBlogCover(file: File): Promise<string> {
  const bitmap = await open(file);
  try {
    const { blob } = await encode(bitmap, 1600, 0.85, 400_000);
    const path = `blog/${crypto.randomUUID()}.webp`;
    await put(path, blob);
    return path;
  } finally {
    bitmap.close();
  }
}

/** Upload a partner logo (longest edge 800px, transparency kept) under partners/ and return its storage path. */
export async function uploadPartnerLogo(file: File): Promise<string> {
  const bitmap = await open(file);
  try {
    const { blob } = await encode(bitmap, 800, 0.9, 200_000);
    const path = `partners/${crypto.randomUUID()}.webp`;
    await put(path, blob);
    return path;
  } finally {
    bitmap.close();
  }
}

export async function removeMedia(paths: Array<string | null | undefined>) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(BUCKET).remove(list);
}
