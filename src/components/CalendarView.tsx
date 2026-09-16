import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CalEvent {
  id: string;
  title: string;
  type: 'session' | 'exam_window' | 'deadline' | 'holiday' | 'other';
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location?: string;
  description?: string;
  courseTitle?: string | null;
}

export const EVENT_TONES: Record<CalEvent['type'], string> = {
  session: 'bg-blue-100 text-blue-800 border-blue-200',
  exam_window: 'bg-purple-100 text-purple-800 border-purple-200',
  deadline: 'bg-red-100 text-red-800 border-red-200',
  holiday: 'bg-green-100 text-green-800 border-green-200',
  other: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView({
  events,
  onEventClick,
  onAddOnDay,
}: {
  events: CalEvent[];
  onEventClick?: (e: CalEvent) => void;
  onAddOnDay?: (isoDate: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = new Date(e.starts_at).toDateString();
      m.set(key, [...(m.get(key) ?? []), e]);
    }
    return m;
  }, [events]);

  const upcoming = useMemo(
    () =>
      [...events]
        .filter((e) => new Date(e.ends_at ?? e.starts_at) >= new Date(Date.now() - 86400000))
        .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
        .slice(0, 8),
    [events],
  );

  const today = new Date().toDateString();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-[1.75rem] border border-white/60 bg-white/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold text-neutral-900">
            {cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <div className="flex gap-1">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg p-1.5 hover:bg-black/[0.05]">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCursor(new Date())} className="rounded-lg px-2 py-1.5 text-xs hover:bg-black/[0.05]">
              Today
            </button>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg p-1.5 hover:bg-black/[0.05]">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-neutral-400">
          {DOW.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            if (!d) return <div key={i} className="min-h-[84px] rounded-lg bg-transparent" />;
            const dayEvents = byDay.get(d.toDateString()) ?? [];
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return (
              <div
                key={i}
                onClick={() => onAddOnDay?.(iso)}
                className={`min-h-[84px] rounded-lg border p-1.5 text-left transition-colors ${
                  onAddOnDay ? 'cursor-pointer hover:border-blue-200' : ''
                } ${d.toDateString() === today ? 'border-blue-300 bg-blue-50/40' : 'border-white/60 bg-white/40'}`}
              >
                <div className="text-[11px] font-medium text-neutral-500">{d.getDate()}</div>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick?.(e);
                      }}
                      className={`block w-full truncate rounded border px-1 py-0.5 text-left text-[10px] ${EVENT_TONES[e.type]}`}
                    >
                      {e.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && <div className="text-[10px] text-neutral-400">+{dayEvents.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-neutral-700">Upcoming</div>
        <div className="space-y-2">
          {!upcoming.length && <p className="text-sm text-neutral-400">Nothing scheduled.</p>}
          {upcoming.map((e) => (
            <button
              key={e.id}
              onClick={() => onEventClick?.(e)}
              className="block w-full rounded-xl border border-white/60 bg-white/50 p-3 text-left hover:bg-white/80"
            >
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${EVENT_TONES[e.type].split(' ')[0]}`} />
                <span className="text-sm font-medium text-neutral-900">{e.title}</span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {new Date(e.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: e.all_day ? undefined : '2-digit', minute: e.all_day ? undefined : '2-digit' })}
                {e.courseTitle ? ` · ${e.courseTitle}` : ''}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
