import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, FolderUp, Images, Pencil, Plus, Tags, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { slugify } from '../../lib/slug';
import { publicUrl, removeMedia, uploadGalleryImage } from '../../lib/siteMedia';
import { GlassCard } from '../../components/ui/shared';
import { AllPhotos } from './gallery/AllPhotos';
import { ImportPhotos } from './gallery/ImportPhotos';
import { PhotoEditor } from './gallery/PhotoEditor';
import type { Album, Category, ImageRow } from './gallery/galleryTypes';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

interface ImageStub { album_id: string; thumb_path: string }

const randomSuffix = () => crypto.randomUUID().slice(0, 6);

export function AdminSiteGallery() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('site-gallery');

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [albumModal, setAlbumModal] = useState<Album | 'new' | null>(null);
  const [catModal, setCatModal] = useState(false);
  const [tab, setTab] = useState<'albums' | 'photos'>('albums');
  const [importing, setImporting] = useState(false);

  const cats = useQuery(
    () => unwrap(supabase.from('site_gallery_categories').select('*').order('sort_order').order('name')) as Promise<Category[]>,
    [],
  );
  const albums = useQuery(async () => {
    // Supabase returns at most 1000 rows per request, so page through the image list.
    const fetchImageStubs = async () => {
      const all: ImageStub[] = [];
      for (let from = 0; ; from += 1000) {
        const page = await unwrap<ImageStub[]>(supabase.from('site_gallery_images').select('album_id, thumb_path').order('sort_order').order('id').range(from, from + 999));
        all.push(...page);
        if (page.length < 1000) return all;
      }
    };
    const [rows, imgs] = await Promise.all([
      unwrap(supabase.from('site_gallery_albums').select('*').order('event_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })) as Promise<Album[]>,
      fetchImageStubs(),
    ]);
    return { rows, imgs };
  }, []);

  const activeCategory = categoryId ?? cats.data?.[0]?.id ?? null;
  const summary = useMemo(() => {
    const count = new Map<string, number>();
    const cover = new Map<string, string>();
    for (const i of albums.data?.imgs ?? []) {
      count.set(i.album_id, (count.get(i.album_id) ?? 0) + 1);
      if (!cover.has(i.album_id)) cover.set(i.album_id, i.thumb_path);
    }
    return { count, cover };
  }, [albums.data]);

  const refresh = () => { cats.refetch(); albums.refetch(); };
  const album = albums.data?.rows.find((a) => a.id === albumId) ?? null;

  if (!cats.data || !albums.data) return cats.error || albums.error ? <EmptyState icon={<Images size={22} />} title="Could not load the gallery" description={cats.error ?? albums.error ?? undefined} /> : <Spinner />;

  if (album) {
    return (
      <AlbumDetail
        album={album}
        category={cats.data?.find((c) => c.id === album.category_id)?.name ?? ''}
        writable={writable}
        onBack={() => setAlbumId(null)}
        onChanged={refresh}
        onEdit={() => setAlbumModal(album)}
        onDeleted={() => { setAlbumId(null); refresh(); }}
        editModal={
          <AlbumModal
            value={albumModal}
            categories={cats.data ?? []}
            defaultCategoryId={activeCategory}
            onClose={() => setAlbumModal(null)}
            onSaved={(a) => { setAlbumModal(null); setAlbumId(a?.id ?? albumId); refresh(); }}
          />
        }
      />
    );
  }

  const shown = (albums.data?.rows ?? []).filter((a) => a.category_id === activeCategory);

  return (
    <div>
      <PageHeader
        title="Site Gallery"
        subtitle="Photos shown on the public website, grouped by category and event"
        actions={
          writable && (
            <>
              <Button variant="secondary" onClick={() => setImporting(true)}><FolderUp size={15} /> Import photos</Button>
              <Button variant="secondary" onClick={() => setCatModal(true)}><Tags size={15} /> Categories</Button>
              <Button onClick={() => setAlbumModal('new')} disabled={!cats.data?.length}><Plus size={15} /> New album</Button>
            </>
          )
        }
      />

      <div className="mb-5 inline-flex rounded-full border border-white/60 bg-white/50 p-1 text-sm">
        {([['albums', 'Albums by category'], ['photos', 'All photos']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 font-medium transition-colors ${tab === k ? 'bg-[#1a1a1a] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'photos' ? (
        <AllPhotos albums={albums.data?.rows ?? []} categories={cats.data ?? []} writable={writable} onChanged={refresh} />
      ) : !cats.data?.length ? (
        <EmptyState icon={<Images size={22} />} title="No categories yet" description="Create a category (for example Team, Workshops or Flying) to start." />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {cats.data.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  c.id === activeCategory ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-700 hover:bg-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {!shown.length ? (
            <EmptyState icon={<Images size={22} />} title="No albums in this category" description={writable ? 'Create an album, then upload photos into it.' : undefined} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((a) => {
                const cover = summary.cover.get(a.id);
                return (
                  <button key={a.id} onClick={() => setAlbumId(a.id)} className="text-left">
                    <GlassCard className="overflow-hidden transition-transform hover:-translate-y-0.5">
                      <div className="flex aspect-[4/3] items-center justify-center bg-neutral-100">
                        {cover ? <img src={publicUrl(cover)} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Images size={28} className="text-neutral-300" />}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-neutral-900">{a.title}</div>
                          <Badge tone={a.is_published ? 'green' : 'amber'}>{a.is_published ? 'Published' : 'Draft'}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {summary.count.get(a.id) ?? 0} photos{a.event_date ? ` · ${new Date(a.event_date).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                    </GlassCard>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <AlbumModal
        value={albumModal}
        categories={cats.data ?? []}
        defaultCategoryId={activeCategory}
        onClose={() => setAlbumModal(null)}
        onSaved={(a) => { setAlbumModal(null); if (a) { setCategoryId(a.category_id); setAlbumId(a.id); } refresh(); }}
      />
      {importing && <ImportPhotos categories={cats.data ?? []} albums={albums.data?.rows ?? []} onClose={() => setImporting(false)} onDone={refresh} />}
      <CategoriesModal
        open={catModal}
        categories={cats.data ?? []}
        albumCounts={(albums.data?.rows ?? []).reduce((m, a) => m.set(a.category_id, (m.get(a.category_id) ?? 0) + 1), new Map<string, number>())}
        onClose={() => setCatModal(false)}
        onChanged={refresh}
      />
    </div>
  );
}

/* ------------------------------------------------------------ album detail --- */
function AlbumDetail({ album, category, writable, onBack, onChanged, onEdit, onDeleted, editModal }: {
  album: Album; category: string; writable: boolean;
  onBack: () => void; onChanged: () => void; onEdit: () => void; onDeleted: () => void; editModal: React.ReactNode;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [editing, setEditing] = useState<ImageRow | null>(null);

  const images = useQuery(
    () => unwrap(supabase.from('site_gallery_images').select('*').eq('album_id', album.id).order('sort_order').order('created_at')) as Promise<ImageRow[]>,
    [album.id],
  );
  const everything = useQuery(async () => {
    const [a, c] = await Promise.all([
      unwrap(supabase.from('site_gallery_albums').select('*')) as Promise<Album[]>,
      unwrap(supabase.from('site_gallery_categories').select('*').order('sort_order')) as Promise<Category[]>,
    ]);
    return { albums: a, categories: c };
  }, []);

  const upload = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    setProgress({ done: 0, total: list.length });
    const failed: string[] = [];
    for (let n = 0; n < list.length; n++) {
      const file = list[n];
      try {
        const up = await uploadGalleryImage(album.id, file);
        const { error } = await supabase.from('site_gallery_images').insert({ album_id: album.id, ...up, source_name: file.name.slice(0, 200) });
        if (error) {
          await removeMedia([up.full_path, up.medium_path, up.thumb_path]);
          throw new Error(error.message);
        }
      } catch (e) {
        failed.push(`${file.name}: ${e instanceof Error ? e.message : 'failed'}`);
      }
      setProgress({ done: n + 1, total: list.length });
    }
    setProgress(null);
    if (fileRef.current) fileRef.current.value = '';
    if (failed.length) toast(`${failed.length} of ${list.length} photos failed — ${failed[0]}`, 'error');
    else toast(`${list.length} photo${list.length > 1 ? 's' : ''} uploaded`);
    images.refetch();
    onChanged();
  };

  const toggleImage = async (img: ImageRow) => {
    const { error } = await supabase.from('site_gallery_images').update({ is_published: !img.is_published }).eq('id', img.id);
    if (error) return toast(error.message, 'error');
    images.refetch();
  };

  const removeImage = async (img: ImageRow) => {
    if (!confirm('Delete this photo from the website? This cannot be undone.')) return;
    const { error } = await supabase.from('site_gallery_images').delete().eq('id', img.id);
    if (error) return toast(error.message, 'error');
    await removeMedia([img.full_path, img.medium_path, img.thumb_path]);
    images.refetch();
    onChanged();
  };

  const togglePublished = async () => {
    const { error } = await supabase.from('site_gallery_albums').update({ is_published: !album.is_published }).eq('id', album.id);
    if (error) return toast(error.message, 'error');
    toast(album.is_published ? 'Album hidden from the website' : 'Album is now live on the website');
    onChanged();
  };

  const removeAlbum = async () => {
    const paths = (images.data ?? []).flatMap((i) => [i.full_path, i.medium_path, i.thumb_path]);
    if (!confirm(`Delete the album "${album.title}" and its ${images.data?.length ?? 0} photos? This cannot be undone.`)) return;
    const { error } = await supabase.from('site_gallery_albums').delete().eq('id', album.id);
    if (error) return toast(error.message, 'error');
    await removeMedia(paths);
    toast('Album deleted');
    onDeleted();
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft size={15} /> All albums
      </button>
      <PageHeader
        title={album.title}
        subtitle={`${category}${album.event_date ? ` · ${new Date(album.event_date).toLocaleDateString()}` : ''}${album.description ? ` · ${album.description}` : ''}`}
        actions={
          writable && (
            <>
              <Badge tone={album.is_published ? 'green' : 'amber'}>{album.is_published ? 'Published' : 'Draft'}</Badge>
              <Button variant="secondary" onClick={togglePublished}>
                {album.is_published ? <><EyeOff size={15} /> Unpublish</> : <><Eye size={15} /> Publish</>}
              </Button>
              <Button variant="secondary" onClick={onEdit}><Pencil size={15} /> Edit</Button>
              <Button variant="ghost" onClick={removeAlbum} title="Delete album"><Trash2 size={15} /></Button>
            </>
          )
        }
      />

      {writable && (
        <GlassCard className="mb-5 p-5">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={!!progress}
            onChange={(e) => upload(e.target.files)}
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-white/80 file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
          <p className="mt-2 text-xs text-neutral-500">
            Choose one or many photos (JPG, PNG or WebP). They are resized and compressed in your browser before upload, so large camera originals are fine.
          </p>
          {progress && (
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
              <Upload size={15} className="animate-pulse" /> Uploading {progress.done} / {progress.total}…
            </div>
          )}
        </GlassCard>
      )}

      {images.loading ? (
        <Spinner />
      ) : !images.data?.length ? (
        <EmptyState icon={<Images size={22} />} title="No photos in this album yet" description={writable ? 'Upload the first photos above.' : undefined} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.data.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-xl bg-neutral-100">
              <button type="button" onClick={() => setEditing(img)} className="block w-full" title="Edit this photo">
                <img src={publicUrl(img.thumb_path)} alt={img.caption} loading="lazy" decoding="async" width={img.width} height={img.height} className={`aspect-square w-full object-cover ${img.is_published ? '' : 'opacity-40'}`} />
              </button>
              {writable && (
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => toggleImage(img)} title={img.is_published ? 'Hide this photo' : 'Show this photo'} className="rounded-full bg-white/90 p-1.5 text-neutral-800">
                    {img.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => removeImage(img)} title="Delete photo" className="rounded-full bg-white/90 p-1.5 text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editModal}
      {editing && everything.data && (
        <PhotoEditor image={editing} albums={everything.data.albums} categories={everything.data.categories} writable={writable} onClose={() => setEditing(null)} onChanged={() => { images.refetch(); onChanged(); }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- album modal --- */
function AlbumModal({ value, categories, defaultCategoryId, onClose, onSaved }: {
  value: Album | 'new' | null; categories: Category[]; defaultCategoryId: string | null;
  onClose: () => void; onSaved: (album: Album | null) => void;
}) {
  const toast = useToast();
  const existing = value && value !== 'new' ? value : null;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<unknown>(null);

  // reset the form whenever the modal opens for a different album
  if (value && loadedFor !== value) {
    setLoadedFor(value);
    setTitle(existing?.title ?? '');
    setDescription(existing?.description ?? '');
    setDate(existing?.event_date ?? '');
    setCategoryId(existing?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? '');
  }
  if (!value && loadedFor) setLoadedFor(null);

  const save = async () => {
    if (!title.trim()) return toast('Give the album a title', 'error');
    if (!categoryId) return toast('Choose a category', 'error');
    setSaving(true);
    const fields = { title: title.trim(), description: description.trim(), event_date: date || null, category_id: categoryId };
    const res = existing
      ? await supabase.from('site_gallery_albums').update(fields).eq('id', existing.id).select().single()
      : await supabase.from('site_gallery_albums').insert({ ...fields, slug: `${slugify(title) || 'album'}-${randomSuffix()}` }).select().single();
    setSaving(false);
    if (res.error) return toast(res.error.message, 'error');
    toast(existing ? 'Album updated' : 'Album created — upload photos, then publish it');
    onSaved(res.data as Album);
  };

  return (
    <Modal open={!!value} onClose={onClose} title={existing ? 'Edit album' : 'New album'}>
      <div className="space-y-4">
        <Field label="Title" required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Workshop 2 – ABC College" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Event date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Short description">
          <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{existing ? 'Save' : 'Create album'}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------- categories modal --- */
function CategoriesModal({ open, categories, albumCounts, onClose, onChanged }: {
  open: boolean; categories: Category[]; albumCounts: Map<string, number>; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const { error } = await supabase.from('site_gallery_categories').insert({
      name: n,
      slug: `${slugify(n) || 'category'}-${randomSuffix()}`,
      sort_order: (categories.at(-1)?.sort_order ?? 0) + 1,
    });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    setName('');
    onChanged();
  };

  const rename = async (c: Category, next: string) => {
    const n = next.trim();
    if (!n || n === c.name) return;
    const { error } = await supabase.from('site_gallery_categories').update({ name: n }).eq('id', c.id);
    if (error) return toast(error.message, 'error');
    onChanged();
  };

  const move = async (c: Category, dir: -1 | 1) => {
    const i = categories.findIndex((x) => x.id === c.id);
    const other = categories[i + dir];
    if (!other) return;
    const a = await supabase.from('site_gallery_categories').update({ sort_order: other.sort_order }).eq('id', c.id);
    const b = await supabase.from('site_gallery_categories').update({ sort_order: c.sort_order }).eq('id', other.id);
    if (a.error || b.error) return toast((a.error ?? b.error)!.message, 'error');
    onChanged();
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete the category "${c.name}"?`)) return;
    const { error } = await supabase.from('site_gallery_categories').delete().eq('id', c.id);
    if (error) return toast(error.message, 'error');
    onChanged();
  };

  return (
    <Modal open={open} onClose={onClose} title="Gallery categories">
      <div className="space-y-2">
        {categories.map((c, idx) => {
          const used = albumCounts.get(c.id) ?? 0;
          return (
            <div key={c.id} className="flex items-center gap-2">
              <div className="flex flex-col">
                <button type="button" disabled={idx === 0} onClick={() => move(c, -1)} className="text-neutral-400 hover:text-neutral-800 disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
                <button type="button" disabled={idx === categories.length - 1} onClick={() => move(c, 1)} className="text-neutral-400 hover:text-neutral-800 disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button>
              </div>
              <TextInput defaultValue={c.name} onBlur={(e) => rename(c, e.target.value)} />
              <span className="w-20 shrink-0 text-xs text-neutral-500">{used} album{used === 1 ? '' : 's'}</span>
              <Button variant="ghost" onClick={() => remove(c)} disabled={used > 0} title={used > 0 ? 'Delete or move its albums first' : 'Delete category'}>
                <Trash2 size={15} />
              </Button>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Competitions" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button onClick={add} loading={busy}><Plus size={15} /> Add</Button>
      </div>
    </Modal>
  );
}
