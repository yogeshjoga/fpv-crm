import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DRIVE_ID = /^[A-Za-z0-9_-]{25,}$/;

function driveLink(id: string) {
  return `https://drive.google.com/file/d/${id}/view`;
}
function driveThumb(id: string) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w320`;
}

/** Preview a file stored in our enrollment-uploads bucket via a signed URL. */
function StoredFilePreview({ path, name, mime }: { path: string; name?: string; mime?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    supabase.storage
      .from('enrollment-uploads')
      .createSignedUrl(path, 600)
      .then(({ data }) => live && setUrl(data?.signedUrl ?? null));
    return () => {
      live = false;
    };
  }, [path]);

  if (!url) return <span className="text-xs text-neutral-400">loading…</span>;
  const isImage = (mime ?? '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name ?? '');
  if (isImage && !failed) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={name ?? 'upload'}
          className="max-h-40 rounded-lg border border-white/60 object-contain"
          onError={() => setFailed(true)}
        />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
      {name ?? 'Download file'}
    </a>
  );
}

function renderScalar(v: string, i: number) {
  const idMatch = DRIVE_ID.test(v);
  const isUrl = /^https?:\/\//i.test(v);
  const driveIdInUrl = isUrl ? v.match(/\/d\/([-\w]{25,})/)?.[1] ?? null : null;
  if (idMatch || driveIdInUrl) {
    const id = idMatch ? v : (driveIdInUrl as string);
    return (
      <a key={i} href={isUrl ? v : driveLink(id)} target="_blank" rel="noreferrer" className="inline-block">
        <img
          src={driveThumb(id)}
          alt="upload"
          className="h-20 w-20 rounded-lg border border-white/60 object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).replaceWith(
              Object.assign(document.createElement('span'), {
                className: 'text-blue-600 underline text-xs',
                textContent: 'Open file',
              }),
            );
          }}
        />
      </a>
    );
  }
  if (isUrl)
    return (
      <a key={i} href={v} target="_blank" rel="noreferrer" className="break-all text-blue-600 underline">
        {v}
      </a>
    );
  return <span key={i}>{v}</span>;
}

/** Renders a form answer: previews stored files, linkifies URLs and Drive IDs. */
export function AnswerValue({ value }: { value: unknown }) {
  if (value && typeof value === 'object' && '__file' in (value as Record<string, unknown>)) {
    const f = value as { __file: string; name?: string; mime?: string };
    return <StoredFilePreview path={f.__file} name={f.name} mime={f.mime} />;
  }
  const parts = Array.isArray(value) ? value : [value];
  const rendered = parts
    .map((raw) => (raw && typeof raw === 'object' && '__file' in raw ? raw : String(raw ?? '').trim()))
    .filter((x) => x && (typeof x !== 'string' || x.length))
    .map((v, i) => {
      if (v && typeof v === 'object' && '__file' in v) {
        const f = v as { __file: string; name?: string; mime?: string };
        return <StoredFilePreview key={i} path={f.__file} name={f.name} mime={f.mime} />;
      }
      const s = v as string;
      return renderScalar(s, i);
    });
  if (!rendered.length) return <>—</>;
  return <div className="flex flex-wrap items-center gap-2">{rendered}</div>;
}
