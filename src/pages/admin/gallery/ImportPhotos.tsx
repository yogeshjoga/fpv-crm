import { useMemo, useRef, useState } from 'react';
import { FolderUp, Upload } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { slugify } from '../../../lib/slug';
import { removeMedia, uploadGalleryImage } from '../../../lib/siteMedia';
import { Button, Checkbox, Field, Modal, Select, useToast } from '../../../components/ui/kit';
import type { Album, Category } from './galleryTypes';

const IMAGE = /\.(jpe?g|png|webp)$/i;
const UNSORTED_CATEGORY = 'Uncategorized';
const UNSORTED_ALBUM = 'Imported photos';
const suffix = () => crypto.randomUUID().slice(0, 6);

interface Planned {
  file: File;
  category: string;
  album: string;
}

/**
 * Bring in a whole folder of existing website photos at once.
 *   Category/Album/photo.jpg  -> that category and album
 *   Album/photo.jpg           -> the chosen category, that album
 *   photo.jpg                 -> "Imported photos", to be sorted afterwards
 * Missing categories and albums are created; a photo already imported (same file name in the same album) is skipped, so a
 * folder can safely be imported again. Every photo is resized and compressed in the browser first.
 */
export function ImportPhotos({ categories, albums, onClose, onDone }: { categories: Category[]; albums: Album[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [publish, setPublish] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number; skipped: number } | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  const planned = useMemo<Planned[]>(() => {
    const fallbackCategory = categories.find((c) => c.id === defaultCategory)?.name ?? UNSORTED_CATEGORY;
    return files
      .filter((f) => IMAGE.test(f.name))
      .map((file) => {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        const parts = rel ? rel.split('/').slice(1, -1).filter(Boolean) : []; // drop the picked folder's own name and the file name
        if (parts.length >= 2) return { file, category: parts[0], album: parts[1] };
        if (parts.length === 1) return { file, category: fallbackCategory, album: parts[0] };
        return { file, category: fallbackCategory, album: UNSORTED_ALBUM };
      });
  }, [files, defaultCategory, categories]);

  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of planned) m.set(`${p.category} / ${p.album}`, (m.get(`${p.category} / ${p.album}`) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [planned]);
  const ignored = files.length - planned.length;

  const run = async () => {
    if (!planned.length) return;
    setFailures([]);
    setProgress({ done: 0, total: planned.length, skipped: 0 });
    try {
      // 1. make sure every category and album exists (sequentially, so nothing is created twice)
      const catIds = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
      const albumIds = new Map(albums.map((a) => [`${a.category_id}|${a.title.toLowerCase()}`, a.id]));
      let nextSort = (categories.at(-1)?.sort_order ?? 0) + 1;
      for (const g of new Set(planned.map((p) => `${p.category}\u0000${p.album}`))) {
        const [catName, albumName] = g.split('\u0000');
        let catId = catIds.get(catName.toLowerCase());
        if (!catId) {
          const { data, error } = await supabase
            .from('site_gallery_categories')
            .insert({ name: catName.slice(0, 80), slug: `${slugify(catName) || 'category'}-${suffix()}`, sort_order: nextSort++ })
            .select('id')
            .single();
          if (error) throw new Error(`Could not create the category "${catName}": ${error.message}`);
          catId = data.id as string;
          catIds.set(catName.toLowerCase(), catId);
        }
        const key = `${catId}|${albumName.toLowerCase()}`;
        if (!albumIds.has(key)) {
          const { data, error } = await supabase
            .from('site_gallery_albums')
            .insert({ category_id: catId, title: albumName.slice(0, 120), slug: `${slugify(albumName) || 'album'}-${suffix()}`, is_published: publish })
            .select('id')
            .single();
          if (error) throw new Error(`Could not create the album "${albumName}": ${error.message}`);
          albumIds.set(key, data.id as string);
        }
      }

      // 2. what is already there (same file name in the same album), so a repeat import does nothing twice
      const targetAlbums = [...new Set(planned.map((p) => albumIds.get(`${catIds.get(p.category.toLowerCase())}|${p.album.toLowerCase()}`)!))];
      const have = new Set<string>();
      const { data: existing } = await supabase.from('site_gallery_images').select('album_id, source_name').in('album_id', targetAlbums).not('source_name', 'is', null);
      for (const r of existing ?? []) have.add(`${r.album_id}|${r.source_name}`);

      // 3. compress and upload, three at a time
      const queue = [...planned];
      let done = 0;
      let skipped = 0;
      const bad: string[] = [];
      const worker = async () => {
        for (let p = queue.shift(); p; p = queue.shift()) {
          const albumId = albumIds.get(`${catIds.get(p.category.toLowerCase())}|${p.album.toLowerCase()}`)!;
          try {
            if (have.has(`${albumId}|${p.file.name}`)) skipped++;
            else {
              const up = await uploadGalleryImage(albumId, p.file);
              const { error } = await supabase.from('site_gallery_images').insert({ album_id: albumId, ...up, source_name: p.file.name.slice(0, 200) });
              if (error) {
                await removeMedia([up.full_path, up.medium_path, up.thumb_path]);
                throw new Error(error.message);
              }
              have.add(`${albumId}|${p.file.name}`);
            }
          } catch (e) {
            bad.push(`${p.file.name}: ${e instanceof Error ? e.message : 'failed'}`);
          }
          done++;
          setProgress({ done, total: planned.length, skipped });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      setFailures(bad);
      toast(`Imported ${planned.length - bad.length - skipped} photo${planned.length - bad.length - skipped === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already there` : ''}${bad.length ? `, ${bad.length} failed` : ''}`, bad.length ? 'error' : undefined);
      onDone();
      if (!bad.length) onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal open onClose={progress ? () => undefined : onClose} title="Import photos" wide>
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          Pick the folder that holds your existing website photos. Sub-folders become albums (and a folder inside a folder becomes a category). Photos are resized and compressed here in your browser, then stored in the CRM.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={folderRef}
            type="file"
            className="hidden"
            multiple
            {...({ webkitdirectory: '' } as object)}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <input ref={filesRef} type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <Button variant="secondary" onClick={() => folderRef.current?.click()} disabled={!!progress}>
            <FolderUp size={15} /> Choose a folder
          </Button>
          <Button variant="secondary" onClick={() => filesRef.current?.click()} disabled={!!progress}>
            <Upload size={15} /> Choose photos
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category for photos that are not inside a category folder" hint="Leave on Uncategorized to sort them afterwards.">
            <Select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} disabled={!!progress}>
              <option value="">{UNSORTED_CATEGORY} (new)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="self-end pb-2">
            <Checkbox label="Show the imported albums on the website right away" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={!!progress} />
          </div>
        </div>

        {files.length > 0 && (
          <div className="rounded-2xl border border-white/70 bg-white/60 p-4">
            <div className="mb-2 text-sm font-medium text-neutral-800">
              {planned.length} photo{planned.length === 1 ? '' : 's'} ready{ignored ? `, ${ignored} other file${ignored === 1 ? '' : 's'} ignored (only JPG, PNG and WebP are imported)` : ''}
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-neutral-700">
              {groups.map(([name, n]) => (
                <li key={name} className="flex justify-between gap-3">
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 text-neutral-500">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {progress && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-neutral-600">
              <span>
                Importing {progress.done} / {progress.total}
                {progress.skipped ? ` (${progress.skipped} already there)` : ''}
              </span>
              <span>{Math.round((progress.done / progress.total) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}
        {failures.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-xl bg-red-50 p-3 text-xs text-red-700">
            {failures.map((f) => (
              <div key={f}>{f}</div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={!!progress}>
            Close
          </Button>
          <Button onClick={run} loading={!!progress} disabled={!planned.length}>
            Import {planned.length || ''} photo{planned.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
