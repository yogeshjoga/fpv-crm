import type React from 'react';
import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { GlassCard } from '../../../components/ui/shared';
import { Badge, Select } from '../../../components/ui/kit';
import { CATEGORIES, DEPARTMENTS, ORDER_STATUS } from '../../../lib/shop';

export function StatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status];
  return <Badge tone={s?.tone ?? 'neutral'}>{s?.label ?? status}</Badge>;
}

export function Panel({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <GlassCard className={`p-5 ${className}`}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-neutral-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </GlassCard>
  );
}

export function StatTile({ label, value, note, to }: { label: string; value: string; note?: string; to?: string }) {
  const body = (
    <GlassCard className="h-full p-4 transition-colors hover:bg-white/60">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      {note && <p className="mt-0.5 text-xs text-neutral-500">{note}</p>}
    </GlassCard>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select required value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>Choose a category</option>
      {DEPARTMENTS.map((d) => (
        <optgroup key={d.slug} label={d.name}>
          {CATEGORIES.filter((c) => c.department === d.slug).map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

/** Product photo with a quiet placeholder when there isn't one (or the brand's CDN refuses it). */
export function Thumb({ src, alt = '', className = 'h-20 w-20' }: { src?: string | null; alt?: string; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white ${className}`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" />
      ) : (
        <ImageOff size={18} className="text-neutral-300" />
      )}
    </span>
  );
}

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
