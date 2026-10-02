import { useMemo, useState } from 'react';
import { Download, Eye, FileText, FolderOpen, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Modal, PageHeader, Spinner, TextInput, useToast } from '../../components/ui/kit';

export interface ResourceRow {
  id: string;
  title: string;
  description: string;
  file_path: string | null;
  external_url: string | null;
  file_name: string;
  mime: string;
  size_bytes: number | null;
  created_at: string;
}

export const isPdf = (r: Pick<ResourceRow, 'mime' | 'file_name'>) => r.mime === 'application/pdf' || /\.pdf$/i.test(r.file_name);

export function fileTypeLabel(r: Pick<ResourceRow, 'file_name'>) {
  const ext = r.file_name.split('.').pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : 'FILE';
}

export function formatSize(bytes: number | null) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** A browser-openable URL for a resource: hosted files as-is, uploaded files via a short-lived signed URL. */
export async function resolveResourceUrl(r: ResourceRow, forDownload: boolean): Promise<string | null> {
  if (r.external_url) return r.external_url;
  if (!r.file_path) return null;
  const { data, error } = await supabase.storage
    .from('library')
    .createSignedUrl(r.file_path, forDownload ? 120 : 600, forDownload ? { download: r.file_name } : undefined);
  return error || !data ? null : data.signedUrl;
}

export function Resources() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<{ row: ResourceRow; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery<ResourceRow[]>(
    () => unwrap(supabase.from('resources').select('*').order('created_at', { ascending: false })) as Promise<ResourceRow[]>,
    [],
  );

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => !s || r.title.toLowerCase().includes(s) || r.description.toLowerCase().includes(s));
  }, [q.data, search]);

  const view = async (r: ResourceRow) => {
    setBusy(`v${r.id}`);
    const url = await resolveResourceUrl(r, false);
    setBusy(null);
    if (!url) return toast('Could not open that file', 'error');
    setViewing({ row: r, url });
  };

  const download = async (r: ResourceRow) => {
    setBusy(`d${r.id}`);
    const url = await resolveResourceUrl(r, true);
    setBusy(null);
    if (!url) return toast('Could not download that file', 'error');
    const a = document.createElement('a');
    a.href = url;
    a.download = r.file_name;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.click();
  };

  return (
    <div>
      <PageHeader
        title="Resources"
        subtitle="Study guides and documents — read PDFs here or download them"
        actions={
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <TextInput placeholder="Search resources…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-9" />
          </div>
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !rows.length ? (
        <EmptyState icon={<FolderOpen size={22} />} title={search ? 'No matching resources' : 'No resources yet'} description="Study material shared by your instructors will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <GlassCard key={r.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 text-neutral-700">
                  <FileText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-neutral-900">{r.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                    <Badge tone="blue">{fileTypeLabel(r)}</Badge>
                    {formatSize(r.size_bytes) && <span>{formatSize(r.size_bytes)}</span>}
                  </div>
                </div>
              </div>
              {r.description && <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-600">{r.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {isPdf(r) && (
                  <Button onClick={() => view(r)} loading={busy === `v${r.id}`}>
                    <Eye size={15} /> View
                  </Button>
                )}
                <Button variant="secondary" onClick={() => download(r)} loading={busy === `d${r.id}`}>
                  <Download size={15} /> Download
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={viewing.row.title} wide>
          <div className="h-[75vh] min-h-[420px] overflow-hidden rounded-xl border border-white/60 bg-white">
            <iframe src={viewing.url} title={viewing.row.title} className="h-full w-full" />
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={() => download(viewing.row)}>
              <Download size={15} /> Download
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
