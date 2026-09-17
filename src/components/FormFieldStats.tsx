import { BarChart3 } from 'lucide-react';
import { GlassCard } from './ui/shared';
import { Badge, EmptyState } from './ui/kit';

export interface FieldStat {
  key: string;
  label: string;
  typeLabel?: string;
  total: number;
  rows: { label: string; count: number }[];
}

/** Renders a grid of per-field answer-distribution cards — reused by the per-form analytics page and the Registrations analytics modal. */
export function FormFieldStatsGrid({ stats }: { stats: FieldStat[] }) {
  if (!stats.length) {
    return (
      <EmptyState
        icon={<BarChart3 size={22} />}
        title="Not enough data yet"
        description="Analytics fill in automatically once there are responses to chart."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {stats.map((s) => (
        <GlassCard key={s.key} className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="font-semibold text-neutral-900">{s.label}</div>
            {s.typeLabel && <Badge>{s.typeLabel}</Badge>}
          </div>
          <div className="space-y-2">
            {s.rows.map((row) => (
              <div key={row.label}>
                <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-neutral-600" title={row.label}>
                    {row.label}
                  </span>
                  <span className="shrink-0 text-neutral-400">
                    {row.count} · {Math.round((row.count / s.total) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.05]">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(4, (row.count / s.total) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-neutral-400">
            {s.total} answer{s.total === 1 ? '' : 's'}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
