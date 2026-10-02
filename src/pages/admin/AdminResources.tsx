import { useRef, useState } from 'react';
import { FileText, FolderOpen, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, PageHeader, Spinner, TextArea, TextInput, useToast } from '../../components/ui/kit';
import { fileTypeLabel, formatSize, type ResourceRow } from '../student/Resources';

const MAX_MB = 50;

export function AdminResources() {
  const toast = useToast();
  const { profile } = useAuth();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('resources');
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const q = useQuery<ResourceRow[]>(
    () => unwrap(supabase.from('resources').select('*').order('created_at', { ascending: false })) as Promise<ResourceRow[]>,
    [],
  );

  const add = async () => {
    if (!file) return toast('Choose a file first', 'error');
    if (!title.trim()) return toast('Give the resource a title', 'error');
    if (file.size > MAX_MB * 1024 * 1024) return toast(`Files must be under ${MAX_MB} MB`, 'error');
    setSaving(true);
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${crypto.randomUUID()}/${safeName}`;
    const up = await supabase.storage.from('library').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) {
      setSaving(false);
      return toast(up.error.message, 'error');
    }
    const { error } = await supabase.from('resources').insert({
      title: title.trim(),
      description: description.trim(),
      file_path: path,
      file_name: file.name,
      mime: file.type,
      size_bytes: file.size,
      uploaded_by: profile!.id,
    });
    setSaving(false);
    if (error) {
      await supabase.storage.from('library').remove([path]);
      return toast(error.message, 'error');
    }
    toast('Resource added — students can see it now');
    setTitle('');
    setDescription('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    q.refetch();
  };

  const remove = async (r: ResourceRow) => {
    if (!confirm(`Remove "${r.title}" for all students?`)) return;
    if (r.file_path) await supabase.storage.from('library').remove([r.file_path]);
    const { error } = await supabase.from('resources').delete().eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast('Resource removed');
    q.refetch();
  };

  return (
    <div>
      <PageHeader title="Resources" subtitle="Study guides and documents every student can read and download" />

      {writable && (
        <GlassCard className="mb-6 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" required>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Flight Controller cheat sheet" />
            </Field>
            <Field label="File (PDF, Word, slides…)" hint={`Up to ${MAX_MB} MB. PDFs can also be read online by students.`} required>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-white/80 file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Short description">
              <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this file and when should students use it?" />
            </Field>
          </div>
          <div className="mt-4">
            <Button onClick={add} loading={saving}>
              <Upload size={15} /> Upload resource
            </Button>
          </div>
        </GlassCard>
      )}

      {q.loading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <EmptyState icon={<FolderOpen size={22} />} title="No resources yet" description="Upload the first file above." />
      ) : (
        <div className="space-y-3">
          {q.data.map((r) => (
            <GlassCard key={r.id} className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 text-neutral-700">
                <FileText size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-neutral-900">{r.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                  <Badge tone="blue">{fileTypeLabel(r)}</Badge>
                  {formatSize(r.size_bytes) && <span>{formatSize(r.size_bytes)}</span>}
                  <span>{r.file_name}</span>
                </div>
              </div>
              {writable && (
                <Button variant="ghost" onClick={() => remove(r)} title="Remove resource">
                  <Trash2 size={15} />
                </Button>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
