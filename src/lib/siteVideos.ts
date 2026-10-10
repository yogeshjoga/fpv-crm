import { supabase } from './supabase';

const BUCKET = 'site-videos';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // the bucket's limit
const POSTER_WIDTH = 1280;

const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/** The 11-character id from any usual YouTube address (watch, youtu.be, shorts, embed, live) or a bare id. */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else {
        const [, kind, value] = url.pathname.split('/');
        if (['shorts', 'embed', 'live', 'v'].includes(kind)) id = value ?? null;
      }
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** YouTube's own still of the video. */
export const youtubePoster = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Checks a video file and explains the problem in plain words. */
export function checkVideoFile(file: File) {
  if (!/^video\/(mp4|webm)$/.test(file.type)) throw new Error(`${file.name}: please use an MP4 or WebM video`);
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`${file.name} is ${(file.size / 1048576).toFixed(0)} MB. The limit is 50 MB, so compress it first (a 720p MP4 is usually 5 to 10 MB per minute)`);
  }
}

/** A still from the video (about one second in), as a WebP, so the poster needs no separate upload. */
export function captureVideoPoster(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This browser could not read the video. Use an MP4 saved with H.264, or choose a poster image yourself'));
    };
    video.onerror = fail;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 1) * 0.1);
    };
    video.onseeked = () => {
      const scale = Math.min(1, POSTER_WIDTH / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return fail();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else fail();
        },
        'image/webp',
        0.82,
      );
    };
    video.src = url;
  });
}

/** Turns any image the admin picks into a WebP poster. */
export async function imageToPoster(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: the poster must be a JPG, PNG or WebP image`);
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, POSTER_WIDTH / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser could not process the image');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This browser could not convert the image'))), 'image/webp', 0.82),
    );
  } finally {
    bitmap.close();
  }
}

export interface Uploaded {
  path: string;
  url: string;
}

async function put(path: string, body: Blob | File, contentType: string): Promise<Uploaded> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message);
  return { path, url: publicUrl(path) };
}

export async function uploadVideoFile(file: File): Promise<Uploaded> {
  checkVideoFile(file);
  const ext = file.type === 'video/webm' ? 'webm' : 'mp4';
  return put(`files/${crypto.randomUUID()}.${ext}`, file, file.type);
}

export const uploadPosterBlob = (blob: Blob) => put(`posters/${crypto.randomUUID()}.webp`, blob, 'image/webp');

export async function removeVideoFiles(paths: Array<string | null | undefined>) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(BUCKET).remove(list);
}
