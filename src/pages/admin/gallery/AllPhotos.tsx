import { useMemo, useState } from 'react';
import { CheckSquare, Eye, EyeOff, Images, Square, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useQuery, unwrap } from '../../../lib/useQuery';
import { publicUrl, removeMedia } from '../../../lib/siteMedia';
import { Badge, Button, EmptyState, Select, Spinner, TextInput, useToast } from '../../../components/ui/kit';
import { albumLabel, type Album, type Category, type ImageRow } from './galleryTypes';
import { PhotoEditor } from './PhotoEditor';

const PAGE = 120;

/** Every photo on the website in one place: filter, select many, and move, show, hide or delete them together. */
export function AllPhotos({ albums, categories, writable, onChanged }: { albums: Album[]; categories: Category[]; writable: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [categoryId, setCategoryId] = useState('all');
  const [albumId, setAlbumId] = useState('all');
  const [state, setState] = useState<'all' | 'shown' | 'hidden'>('all');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ImageRow | null>(null);

  const q = useQuery(async () => {
    const all: ImageRow[] = [];
    for (let from = 0; ; from += 1000) {
      const page = await unwrap<ImageRow[]>(supabase.from('site_gallery_images').select('*').order('created_at', { ascending: false }).order('id').range(from, from + 999));
      all.push(...page);
      if (page.length < 1000) return all;
    }
  }, []);

  const albumById = useMemo(() => new Map(albums.map((a) => [a.id, a])), [albums]);
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((i) => {
      const a = albumById.get(i.album_id);
      if (categoryId !== 'all' && a?.category_id !== categoryId) return false;
      if (albumId !== 'all' && i.album_id !== albumId) return false;
      if (state === 'shown' && !i.is_published) return false;
      if (state === 'hidden' && i.is_published) return false;
      return !s || `${i.caption} ${i.source_name ?? ''}`.toLowerCase().includes(s);
    });
  }, [q.data, albumById, categoryId, albumId, state, search]);
  const visibleAlbums = albums.filter((a) => categoryId === 'all' || a.category_id === categoryId);

  const refresh = () => {
    void q.refetch();
    onChanged();
  };
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const apply = async (patch: Record<string, unknown>, done: string) => {
    setBusy(true);
    const { error } = await supabase.from('site_gallery_images').update(patch as never).in('id', [...picked]);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(done);
    setPicked(new Set());
    setMoveTo('');
    refresh();
  };
  const removePicked = async () => {
    if (!confirm(`Delete ${picked.size} photo${picked.size === 1 ? '' : 's'} from the website? This cannot be undone.`)) return;
    setBusy(true);
    const chosen = (q.data ?? []).filter((i) => picked.has(i.id));
    const { error } = await supabase.from('site_gallery_images').delete().in('id', [...picked]);
    if (!error) await removeMedia(chosen.flatMap((i) => [i.full_path, i.medium_path, i.thumb_path]));
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Deleted');
    setPicked(new Set());
    refresh();
  };

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setAlbumId('all'); setShown(PAGE); }} className="!w-auto">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={albumId} onChange={(e) => { setAlbumId(e.target.value); setShown(PAGE); }} className="!w-auto">
          <option value="all">All albums</option>
          {visibleAlbums.map((a) => (
            <option key={a.id} value={a.id}>
              {albumLabel(a, categories)}
            </option>
          ))}
        </Select>
        <Select value={state} onChange={(e) => setState(e.target.value as typeof state)} className="!w-auto">
          <option value="all">Shown and hidden</option>
          <option value="shown">Shown on the website</option>
          <option value="hidden">Hidden</option>
        </Select>
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search captions or file names…" className="!w-64" />
        <span className="text-sm text-neutral-500">
          {rows.length} of {q.data?.length ?? 0} photos
        </span>
      </div>

      {writable && picked.size > 0 && (
        <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-lg backdrop-blur">
          <Badge tone="blue">{picked.size} selected</Badge>
          <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="!w-auto text-sm">
            <option value="">Move to…</option>
            {[...albums].sort((a, b) => albumLabel(a, categories).localeCompare(albumLabel(b, categories))).map((a) => (
              <option key={a.id} value={a.id}>
                {albumLabel(a, categories)}
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={!moveTo} loading={busy} onClick={() => apply({ album_id: moveTo }, 'Photos moved')}>
            Move
          </Button>
          <Button variant="secondary" loading={busy} onClick={() => apply({ is_published: true }, 'Shown on the website')}>
            <Eye size={14} /> Show
          </Button>
          <Button variant="secondary" loading={busy} onClick={() => apply({ is_published: false }, 'Hidden from the website')}>
            <EyeOff size={14} /> Hide
          </Button>
          <Button variant="ghost" className="text-red-600" loading={busy} onClick={removePicked}>
            <Trash2 size={14} /> Delete
          </Button>
          <Button variant="ghost" onClick={() => setPicked(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {!rows.length ? (
        <EmptyState icon={<Images size={22} />} title="No photos here" description={q.data?.length ? 'Try a different filter.' : writable ? 'Use "Import photos" to bring in your existing website images, or open an album and upload.' : undefined} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {rows.slice(0, shown).map((img) => {
              const on = picked.has(img.id);
              return (
                <div key={img.id} className={`group relative overflow-hidden rounded-xl bg-neutral-100 ${on ? 'ring-2 ring-blue-500' : ''}`}>
                  <button type="button" onClick={() => setEditing(img)} className="block w-full" title={albumById.get(img.album_id) ? albumLabel(albumById.get(img.album_id)!, categories) : ''}>
                    <img src={publicUrl(img.thumb_path)} alt={img.caption} loading="lazy" decoding="async" width={img.width} height={img.height} className={`aspect-square w-full object-cover ${img.is_published ? '' : 'opacity-40'}`} />
                  </button>
                  {writable && (
                    <button type="button" onClick={() => toggle(img.id)} className="absolute left-1.5 top-1.5 rounded-md bg-white/90 p-0.5 text-neutral-700" aria-label={on ? 'Unselect' : 'Select'}>
                      {on ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {rows.length > shown && (
            <div className="mt-4 text-center">
              <Button variant="secondary" onClick={() => setShown(shown + PAGE)}>
                Show more ({rows.length - shown} left)
              </Button>
            </div>
          )}
        </>
      )}

      {editing && <PhotoEditor image={editing} albums={albums} categories={categories} writable={writable} onClose={() => setEditing(null)} onChanged={refresh} />}
    </div>
  );
}
