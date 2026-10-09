import { useState } from 'react';
import { ArrowUpToLine, Eye, EyeOff, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { publicUrl, removeMedia } from '../../../lib/siteMedia';
import { Button, Field, Modal, Select, TextInput, useToast } from '../../../components/ui/kit';
import { albumLabel, type Album, type Category, type ImageRow } from './galleryTypes';

/** Edit one photo: its caption, which album it belongs to, whether it is shown, and its place in the album. */
export function PhotoEditor({
  image,
  albums,
  categories,
  writable,
  onClose,
  onChanged,
}: {
  image: ImageRow;
  albums: Album[];
  categories: Category[];
  writable: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [caption, setCaption] = useState(image.caption);
  const [albumId, setAlbumId] = useState(image.album_id);
  const [published, setPublished] = useState(image.is_published);
  const [busy, setBusy] = useState<string | null>(null);

  const save = async () => {
    setBusy('save');
    const { error } = await supabase
      .from('site_gallery_images')
      .update({ caption: caption.trim(), album_id: albumId, is_published: published })
      .eq('id', image.id);
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast('Photo saved');
    onChanged();
    onClose();
  };

  const makeFirst = async () => {
    setBusy('first');
    const { data } = await supabase.from('site_gallery_images').select('sort_order').eq('album_id', image.album_id).order('sort_order').limit(1).maybeSingle();
    const { error } = await supabase.from('site_gallery_images').update({ sort_order: (data?.sort_order ?? image.sort_order) - 1 }).eq('id', image.id);
    setBusy(null);
    if (error) return toast(error.message, 'error');
    toast('Moved to the front of its album');
    onChanged();
    onClose();
  };

  const remove = async () => {
    if (!confirm('Delete this photo from the website? This cannot be undone.')) return;
    setBusy('delete');
    const { error } = await supabase.from('site_gallery_images').delete().eq('id', image.id);
    if (error) {
      setBusy(null);
      return toast(error.message, 'error');
    }
    await removeMedia([image.full_path, image.medium_path, image.thumb_path]);
    setBusy(null);
    toast('Photo deleted');
    onChanged();
    onClose();
  };

  const sorted = [...albums].sort((a, b) => albumLabel(a, categories).localeCompare(albumLabel(b, categories)));

  return (
    <Modal open onClose={onClose} title="Photo" wide>
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <div className="overflow-hidden rounded-2xl bg-neutral-100">
          <img src={publicUrl(image.medium_path ?? image.full_path)} alt={caption} className="max-h-[60vh] w-full object-contain" />
        </div>
        <div className="space-y-4">
          <Field label="Caption" hint="Optional. Shown with the photo on the website.">
            <TextInput disabled={!writable} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Category and album" hint="Choose another album to move the photo, for example from Imported photos into Workshops.">
            <Select disabled={!writable} value={albumId} onChange={(e) => setAlbumId(e.target.value)}>
              {sorted.map((a) => (
                <option key={a.id} value={a.id}>
                  {albumLabel(a, categories)}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" disabled={!writable} checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 rounded border-neutral-300" />
            {published ? <Eye size={15} /> : <EyeOff size={15} />} Show this photo on the website
          </label>
          <div className="text-xs text-neutral-500">
            {image.width} × {image.height}px{image.source_name ? ` · from ${image.source_name}` : ''}
          </div>
          {writable && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={makeFirst} loading={busy === 'first'} title="Put this photo first in its album">
                  <ArrowUpToLine size={15} /> First
                </Button>
                <Button variant="ghost" className="text-red-600" onClick={remove} loading={busy === 'delete'}>
                  <Trash2 size={15} /> Delete
                </Button>
              </div>
              <Button onClick={save} loading={busy === 'save'}>
                Save
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
