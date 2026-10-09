import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, Eye, EyeOff, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { publicUrl, removeMedia, uploadPartnerLogo } from '../../lib/siteMedia';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Spinner, TextInput, useToast } from '../../components/ui/kit';

interface Partner {
  id: string;
  name: string;
  website_url: string | null;
  logo_path: string;
  sort_order: number;
  is_published: boolean;
}

export function AdminSitePartners() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('site-partners');
  const [editing, setEditing] = useState<Partner | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useQuery(
    () => unwrap(supabase.from('site_partners').select('*').order('sort_order').order('created_at')) as Promise<Partner[]>,
    [],
  );
  const rows = q.data ?? [];

  const togglePublished = async (p: Partner) => {
    setBusy(true);
    const { error } = await supabase.from('site_partners').update({ is_published: !p.is_published }).eq('id', p.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    q.refetch();
  };

  // Writes the whole order so the sequence stays 1..n whatever it was before.
  const move = async (p: Partner, direction: -1 | 1) => {
    const i = rows.findIndex((r) => r.id === p.id);
    const j = i + direction;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setBusy(true);
    const results = await Promise.all(next.map((r, idx) => supabase.from('site_partners').update({ sort_order: idx + 1 }).eq('id', r.id)));
    setBusy(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) toast(failed.error.message, 'error');
    q.refetch();
  };

  const remove = async (p: Partner) => {
    if (!confirm(`Remove ${p.name} from the website? The logo file is deleted too.`)) return;
    setBusy(true);
    const { error } = await supabase.from('site_partners').delete().eq('id', p.id);
    if (!error) await removeMedia([p.logo_path]);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Partner removed');
    q.refetch();
  };

  if (!q.data) return q.error ? <EmptyState icon={<Building2 size={22} />} title="Could not load partners" description={q.error} /> : <Spinner />;

  return (
    <div>
      <PageHeader
        title="Site Partners"
        subtitle="Logos of partners and collaborators shown on the Workshops page. The EGIRE Robotics logo is always shown first."
        actions={writable && <Button onClick={() => setEditing('new')}><Plus size={15} /> Add partner</Button>}
      />

      {!rows.length ? (
        <EmptyState
          icon={<Building2 size={22} />}
          title="No partners yet"
          description={writable ? 'Add a partner logo. The section appears on the website once there is at least one published partner.' : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p, i) => (
            <GlassCard key={p.id} className="overflow-hidden">
              <div className="flex aspect-[3/2] items-center justify-center bg-white p-6">
                <img src={publicUrl(p.logo_path)} alt={p.name} className={`max-h-full max-w-full object-contain ${p.is_published ? '' : 'opacity-40'}`} loading="lazy" />
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-neutral-900">{p.name}</span>
                  {!p.is_published && <Badge tone="amber">Hidden</Badge>}
                </div>
                {p.website_url && (
                  <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-xs text-neutral-500 hover:text-neutral-800">
                    <ExternalLink size={12} /> {p.website_url.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {writable && (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => move(p, -1)} disabled={busy || i === 0} title="Move earlier"><ArrowUp size={15} /></Button>
                      <Button variant="ghost" onClick={() => move(p, 1)} disabled={busy || i === rows.length - 1} title="Move later"><ArrowDown size={15} /></Button>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => togglePublished(p)} disabled={busy} title={p.is_published ? 'Hide from the website' : 'Show on the website'}>
                        {p.is_published ? <Eye size={15} /> : <EyeOff size={15} />}
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(p)} title="Edit"><Pencil size={15} /></Button>
                      <Button variant="ghost" onClick={() => remove(p)} disabled={busy} title="Remove"><Trash2 size={15} /></Button>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {editing && (
        <PartnerModal
          value={editing === 'new' ? null : editing}
          nextOrder={rows.length + 1}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); q.refetch(); }}
        />
      )}
    </div>
  );
}

function PartnerModal({ value, nextOrder, onClose, onSaved }: { value: Partner | null; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(value?.name ?? '');
  const [url, setUrl] = useState(value?.website_url ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName) return toast('Add the partner name', 'error');
    if (!value && !file) return toast('Choose a logo to upload', 'error');
    let link: string | null = url.trim();
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
    if (link && !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(link)) return toast('Enter a valid website address', 'error');

    setBusy(true);
    try {
      const logo_path = file ? await uploadPartnerLogo(file) : value!.logo_path;
      const row = { name: cleanName, website_url: link || null, logo_path };
      const { error } = value
        ? await supabase.from('site_partners').update(row).eq('id', value.id)
        : await supabase.from('site_partners').insert({ ...row, sort_order: nextOrder });
      if (error) {
        if (file) await removeMedia([logo_path]);
        throw new Error(error.message);
      }
      if (value && file) await removeMedia([value.logo_path]);
      toast(value ? 'Partner updated' : 'Partner added');
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the partner', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={value ? 'Edit partner' : 'Add partner'}>
      <div className="space-y-4">
        <Field label="Name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Organisation name" />
        </Field>
        <Field label="Website (optional)" hint="The logo links here. Leave blank for a logo with no link.">
          <TextInput value={url} onChange={(e) => setUrl(e.target.value)} maxLength={300} placeholder="example.com" />
        </Field>
        <Field label={value ? 'Replace logo (optional)' : 'Logo'} required={!value} hint="PNG, JPG or WebP. A transparent PNG on a wide, simple background works best.">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>{file ? 'Choose another' : 'Choose file'}</Button>
            <span className="truncate text-sm text-neutral-500">{file ? file.name : value ? 'Keeping the current logo' : 'No file chosen'}</span>
          </div>
          {(file || value) && (
            <div className="mt-3 flex h-28 items-center justify-center rounded-xl border border-neutral-200 bg-white p-3">
              <img
                src={file ? URL.createObjectURL(file) : publicUrl(value!.logo_path)}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>{value ? 'Save' : 'Add partner'}</Button>
        </div>
      </div>
    </Modal>
  );
}
