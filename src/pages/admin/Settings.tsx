import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { Button, Field, PageHeader, Spinner, TextInput, useToast } from '../../components/ui/kit';
import type { Tables } from '../../lib/database.types';

type Org = Tables<'org_settings'>;

export function Settings() {
  const toast = useToast();
  const q = useQuery<Org>(() => unwrap(supabase.from('org_settings').select('*').single()) as Promise<Org>, []);
  const [form, setForm] = useState<Partial<Org>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const org = { ...(q.data ?? {}), ...form } as Org;
  const set = (k: keyof Org, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('org_settings').update({
      org_name: org.org_name,
      signatory_name: org.signatory_name,
      cert_id_prefix: org.cert_id_prefix,
      support_email: org.support_email,
      verify_base_url: org.verify_base_url,
      default_pass_pct: Number(org.default_pass_pct),
      default_time_limit_min: Number(org.default_time_limit_min),
      default_question_count: Number(org.default_question_count),
      default_max_attempts: Number(org.default_max_attempts),
      default_cooldown_hours: Number(org.default_cooldown_hours),
    }).eq('id', true);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Settings saved');
    q.refetch();
  };

  const uploadBranding = async (kind: 'logo_url' | 'signatory_image_url', file: File) => {
    setUploading(kind);
    const path = `${kind}-${Date.now()}-${file.name}`;
    const up = await supabase.storage.from('branding').upload(path, file, { upsert: true });
    if (up.error) {
      setUploading(null);
      return toast(up.error.message, 'error');
    }
    const { data } = supabase.storage.from('branding').getPublicUrl(path);
    const { error } = await supabase.from('org_settings').update({ [kind]: data.publicUrl } as never).eq('id', true);
    setUploading(null);
    if (error) return toast(error.message, 'error');
    toast('Uploaded');
    q.refetch();
  };

  if (q.loading) return <Spinner />;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Company settings" subtitle="Branding and default exam parameters" />

      <GlassCard className="mb-6 p-6">
        <h2 className="mb-4 font-semibold text-neutral-900">Branding</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <BrandingSlot label="Logo" url={org.logo_url} busy={uploading === 'logo_url'} onFile={(f) => uploadBranding('logo_url', f)} />
          <BrandingSlot
            label="Signature image"
            url={org.signatory_image_url}
            busy={uploading === 'signatory_image_url'}
            onFile={(f) => uploadBranding('signatory_image_url', f)}
          />
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Organization name">
            <TextInput value={org.org_name} onChange={(e) => set('org_name', e.target.value)} />
          </Field>
          <Field label="Certificate ID prefix">
            <TextInput value={org.cert_id_prefix} onChange={(e) => set('cert_id_prefix', e.target.value)} className="font-mono" />
          </Field>
          <Field label="Authorized signatory name">
            <TextInput value={org.signatory_name} onChange={(e) => set('signatory_name', e.target.value)} />
          </Field>
          <Field label="Support email">
            <TextInput value={org.support_email} onChange={(e) => set('support_email', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Verification base URL" hint="Used in certificate QR codes, e.g. https://learn.egirerobotics.com">
              <TextInput value={org.verify_base_url} onChange={(e) => set('verify_base_url', e.target.value)} />
            </Field>
          </div>

          <div className="sm:col-span-2 mt-2 text-sm font-medium text-neutral-700">Default exam parameters (per new course)</div>
          <Field label="Pass %">
            <TextInput type="number" value={org.default_pass_pct} onChange={(e) => set('default_pass_pct', Number(e.target.value))} />
          </Field>
          <Field label="Time limit (min)">
            <TextInput type="number" value={org.default_time_limit_min} onChange={(e) => set('default_time_limit_min', Number(e.target.value))} />
          </Field>
          <Field label="Questions per exam">
            <TextInput type="number" value={org.default_question_count} onChange={(e) => set('default_question_count', Number(e.target.value))} />
          </Field>
          <Field label="Max attempts">
            <TextInput type="number" value={org.default_max_attempts} onChange={(e) => set('default_max_attempts', Number(e.target.value))} />
          </Field>
          <Field label="Cooldown (hours)">
            <TextInput type="number" value={org.default_cooldown_hours} onChange={(e) => set('default_cooldown_hours', Number(e.target.value))} />
          </Field>

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" loading={busy}>
              Save settings
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

function BrandingSlot({ label, url, busy, onFile }: { label: string; url: string | null; busy: boolean; onFile: (f: File) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-neutral-700">{label}</div>
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-2xl border border-white/60 bg-white/50">
        {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-neutral-400">none</span>}
      </div>
      <label className="mt-2 inline-block cursor-pointer text-sm text-blue-600 hover:underline">
        {busy ? 'Uploading…' : 'Upload'}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
    </div>
  );
}
