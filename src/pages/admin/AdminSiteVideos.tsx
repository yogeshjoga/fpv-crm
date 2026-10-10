import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { captureVideoPoster, checkVideoFile, imageToPoster, parseYouTubeId, removeVideoFiles, uploadPosterBlob, uploadVideoFile, youtubePoster } from '../../lib/siteVideos';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';

interface SiteVideo {
  id: string;
  kind: 'file' | 'youtube';
  title: string;
  caption: string;
  video_url: string | null;
  video_url_low: string | null;
  video_path: string | null;
  video_low_path: string | null;
  youtube_id: string | null;
  poster_url: string;
  poster_path: string | null;
  sort_order: number;
  is_published: boolean;
}

export function AdminSiteVideos() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('site-videos');
  const [editing, setEditing] = useState<SiteVideo | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useQuery(() => unwrap(supabase.from('site_videos').select('*').order('sort_order').order('created_at')) as Promise<SiteVideo[]>, []);
  const rows = q.data ?? [];

  const togglePublished = async (v: SiteVideo) => {
    setBusy(true);
    const { error } = await supabase.from('site_videos').update({ is_published: !v.is_published }).eq('id', v.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    q.refetch();
  };

  // Writes the whole order so the sequence stays 1..n whatever it was before.
  const move = async (v: SiteVideo, direction: -1 | 1) => {
    const i = rows.findIndex((r) => r.id === v.id);
    const j = i + direction;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setBusy(true);
    const results = await Promise.all(next.map((r, idx) => supabase.from('site_videos').update({ sort_order: idx + 1 }).eq('id', r.id)));
    setBusy(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) toast(failed.error.message, 'error');
    q.refetch();
  };

  const remove = async (v: SiteVideo) => {
    if (!confirm(`Delete "${v.title}" from the website? Uploaded files are deleted too.`)) return;
    setBusy(true);
    const { error } = await supabase.from('site_videos').delete().eq('id', v.id);
    if (!error) await removeVideoFiles([v.video_path, v.video_low_path, v.poster_path]);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Video deleted');
    q.refetch();
  };

  if (!q.data) return q.error ? <EmptyState icon={<Video size={22} />} title="Could not load videos" description={q.error} /> : <Spinner />;

  return (
    <div>
      <PageHeader
        title="Site Videos"
        subtitle="The video carousel on the Home and Workshops pages. Upload a file or add a YouTube link."
        actions={writable && <Button onClick={() => setEditing('new')}><Plus size={15} /> Add video</Button>}
      />

      {!rows.length ? (
        <EmptyState
          icon={<Video size={22} />}
          title="No videos yet"
          description={writable ? 'Add a video. Until you add one, the website shows its built-in workshop film.' : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((v, i) => (
            <GlassCard key={v.id} className="overflow-hidden">
              <div className="aspect-video bg-neutral-100">
                <img src={v.poster_url} alt="" className={`h-full w-full object-cover ${v.is_published ? '' : 'opacity-40'}`} loading="lazy" />
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-neutral-900">{v.title}</span>
                  <div className="flex shrink-0 gap-1">
                    <Badge tone={v.kind === 'youtube' ? 'red' : 'blue'}>{v.kind === 'youtube' ? 'YouTube' : 'Video file'}</Badge>
                    {!v.is_published && <Badge tone="amber">Hidden</Badge>}
                  </div>
                </div>
                {v.caption && <p className="line-clamp-2 text-sm text-neutral-500">{v.caption}</p>}
                {writable && (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => move(v, -1)} disabled={busy || i === 0} title="Move earlier"><ArrowUp size={15} /></Button>
                      <Button variant="ghost" onClick={() => move(v, 1)} disabled={busy || i === rows.length - 1} title="Move later"><ArrowDown size={15} /></Button>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => togglePublished(v)} disabled={busy} title={v.is_published ? 'Hide from the website' : 'Show on the website'}>
                        {v.is_published ? <Eye size={15} /> : <EyeOff size={15} />}
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(v)} title="Edit"><Pencil size={15} /></Button>
                      <Button variant="ghost" onClick={() => remove(v)} disabled={busy} title="Delete"><Trash2 size={15} /></Button>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {editing && (
        <VideoModal
          value={editing === 'new' ? null : editing}
          nextOrder={rows.length + 1}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            q.refetch();
          }}
        />
      )}
    </div>
  );
}

function VideoModal({ value, nextOrder, onClose, onSaved }: { value: SiteVideo | null; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<'file' | 'youtube'>(value?.kind ?? 'file');
  const [title, setTitle] = useState(value?.title ?? '');
  const [caption, setCaption] = useState(value?.caption ?? '');
  const [link, setLink] = useState(value?.youtube_id ? `https://youtu.be/${value.youtube_id}` : '');
  const [file, setFile] = useState<File | null>(null);
  const [lowFile, setLowFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [autoPoster, setAutoPoster] = useState<string | null>(null); // preview of the still taken from the file
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lowRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);

  const youtubeId = parseYouTubeId(link);

  // Show the still that will be used, as soon as a file is chosen.
  useEffect(() => {
    if (!file) return setAutoPoster(null);
    let live = true;
    let url: string | null = null;
    captureVideoPoster(file)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (live) setAutoPoster(url);
      })
      .catch(() => live && setAutoPoster(null));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  const choose = (picked: File | null, set: (f: File | null) => void, check = true) => {
    if (picked && check) {
      try {
        checkVideoFile(picked);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'That file cannot be used', 'error');
        return;
      }
    }
    set(picked);
  };

  const save = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return toast('Add a title', 'error');
    if (kind === 'youtube' && !youtubeId) return toast('Paste a valid YouTube link', 'error');
    if (kind === 'file' && !value?.video_url && !file) return toast('Choose a video file to upload', 'error');

    setBusy(true);
    const uploaded: string[] = []; // new files, removed again if saving fails
    const oldFiles: Array<string | null> = []; // replaced files, removed after saving
    try {
      const row: Partial<Omit<SiteVideo, 'id'>> = { kind, title: cleanTitle, caption: caption.trim() };

      if (kind === 'youtube') {
        Object.assign(row, { youtube_id: youtubeId, video_url: null, video_url_low: null, video_path: null, video_low_path: null });
        if (value?.kind === 'file') oldFiles.push(value.video_path, value.video_low_path);
        if (posterFile) {
          const p = await uploadPosterBlob(await imageToPoster(posterFile));
          uploaded.push(p.path);
          Object.assign(row, { poster_url: p.url, poster_path: p.path });
          if (value?.poster_path) oldFiles.push(value.poster_path);
        } else if (!value || value.kind === 'file' || value.youtube_id !== youtubeId) {
          Object.assign(row, { poster_url: youtubePoster(youtubeId!) });
          if (value?.poster_path) {
            oldFiles.push(value.poster_path);
            row.poster_path = null;
          }
        }
      } else {
        Object.assign(row, { youtube_id: null });
        if (file) {
          const main = await uploadVideoFile(file);
          uploaded.push(main.path);
          Object.assign(row, { video_url: main.url, video_path: main.path });
          if (value?.video_path) oldFiles.push(value.video_path);
          if (!posterFile) {
            const still = await uploadPosterBlob(await captureVideoPoster(file));
            uploaded.push(still.path);
            Object.assign(row, { poster_url: still.url, poster_path: still.path });
            if (value?.poster_path) oldFiles.push(value.poster_path);
          }
        }
        if (lowFile) {
          const low = await uploadVideoFile(lowFile);
          uploaded.push(low.path);
          Object.assign(row, { video_url_low: low.url, video_low_path: low.path });
          if (value?.video_low_path) oldFiles.push(value.video_low_path);
        }
        if (posterFile) {
          const p = await uploadPosterBlob(await imageToPoster(posterFile));
          uploaded.push(p.path);
          Object.assign(row, { poster_url: p.url, poster_path: p.path });
          if (value?.poster_path) oldFiles.push(value.poster_path);
        }
      }

      if (!value && !row.poster_url) throw new Error('A poster image is needed. Choose one and try again');
      const { error } = value
        ? await supabase.from('site_videos').update(row).eq('id', value.id)
        : await supabase.from('site_videos').insert({ ...row, kind, title: cleanTitle, poster_url: row.poster_url as string, sort_order: nextOrder });
      if (error) throw new Error(error.message);
      await removeVideoFiles(oldFiles);
      toast(value ? 'Video updated' : 'Video added');
      onSaved();
    } catch (e) {
      await removeVideoFiles(uploaded);
      toast(e instanceof Error ? e.message : 'Could not save the video', 'error');
    } finally {
      setBusy(false);
    }
  };

  const previewSrc = posterFile ? URL.createObjectURL(posterFile) : kind === 'youtube' ? (youtubeId ? youtubePoster(youtubeId) : null) : autoPoster ?? value?.poster_url ?? null;

  return (
    <Modal open onClose={onClose} title={value ? 'Edit video' : 'Add video'} wide>
      <div className="space-y-4">
        <div className="flex gap-2">
          {(['file', 'youtube'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${kind === k ? 'bg-[#1a1a1a] text-white' : 'bg-white/70 text-neutral-700 hover:bg-white'}`}
            >
              {k === 'file' ? 'Upload a video file' : 'YouTube link'}
            </button>
          ))}
        </div>

        <Field label="Title" required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Workshop at Sri Sivani College of Engineering" />
        </Field>
        <Field label="Short description (optional)" hint="One line shown under the video.">
          <TextArea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} maxLength={300} />
        </Field>

        {kind === 'youtube' ? (
          <Field label="YouTube link" required hint={link && !youtubeId ? 'That does not look like a YouTube link.' : 'Any YouTube address works: watch, youtu.be, Shorts or embed. It plays in YouTube\'s privacy-enhanced player, only when a visitor presses play.'} error={link && !youtubeId ? 'Not a valid YouTube link' : undefined}>
            <TextInput value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          </Field>
        ) : (
          <>
            <input ref={fileRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => choose(e.target.files?.[0] ?? null, setFile)} />
            <input ref={lowRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => choose(e.target.files?.[0] ?? null, setLowFile)} />
            <Field label={value?.video_url ? 'Replace the video file (optional)' : 'Video file'} required={!value?.video_url} hint="MP4 (H.264) or WebM, up to 50 MB. Compress long videos first; 720p is plenty. The video plays without sound.">
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>{file ? 'Choose another' : 'Choose file'}</Button>
                <span className="truncate text-sm text-neutral-500">{file ? `${file.name} (${(file.size / 1048576).toFixed(1)} MB)` : value?.video_url ? 'Keeping the current video' : 'No file chosen'}</span>
              </div>
            </Field>
            <Field label="Lighter copy for phones (optional)" hint="A smaller file, for example 480p, used on phones and slow connections.">
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => lowRef.current?.click()}>{lowFile ? 'Choose another' : 'Choose file'}</Button>
                <span className="truncate text-sm text-neutral-500">{lowFile ? `${lowFile.name} (${(lowFile.size / 1048576).toFixed(1)} MB)` : value?.video_url_low ? 'Keeping the current phone copy' : 'None'}</span>
              </div>
            </Field>
          </>
        )}

        <Field label="Poster image" hint={kind === 'file' ? 'Taken automatically from the first second of the video. Choose an image only if you want a different one.' : 'YouTube\'s own thumbnail is used. Choose an image only if you want a different one.'}>
          <input ref={posterRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => posterRef.current?.click()}>{posterFile ? 'Choose another' : 'Choose a different image'}</Button>
            {posterFile && <span className="truncate text-sm text-neutral-500">{posterFile.name}</span>}
          </div>
          {previewSrc && (
            <div className="mt-3 aspect-video max-w-xs overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
              <img src={previewSrc} alt="" className="h-full w-full object-cover" />
            </div>
          )}
        </Field>

        {busy && kind === 'file' && <p className="text-sm text-neutral-500">Uploading. Large files can take a minute, so please keep this window open.</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} loading={busy}>{value ? 'Save' : 'Add video'}</Button>
        </div>
      </div>
    </Modal>
  );
}
