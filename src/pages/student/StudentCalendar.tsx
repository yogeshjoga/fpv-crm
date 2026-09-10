import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useQuery, unwrap } from '../../lib/useQuery';
import { CalendarView, EVENT_TONES } from '../../components/CalendarView';
import type { CalEvent } from '../../components/CalendarView';
import { Modal, PageHeader, Spinner } from '../../components/ui/kit';

export function StudentCalendar() {
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const q = useQuery(async () => {
    const rows = (await unwrap(
      supabase
        .from('calendar_events')
        .select('id, title, description, type, starts_at, ends_at, all_day, location, course:courses(title)')
        .order('starts_at'),
    )) as any[];
    return rows.map((r) => ({ ...r, courseTitle: r.course?.title ?? null })) as CalEvent[];
  }, []);

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Sessions, exam windows and deadlines" />
      {q.loading ? <Spinner /> : <CalendarView events={q.data ?? []} onEventClick={setSelected} />}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ''}>
        {selected && (
          <div className="space-y-3 text-sm">
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${EVENT_TONES[selected.type]}`}>
              {selected.type.replace('_', ' ')}
            </span>
            <div className="text-neutral-600">
              {new Date(selected.starts_at).toLocaleString()}
              {selected.ends_at ? ` – ${new Date(selected.ends_at).toLocaleString()}` : ''}
            </div>
            {selected.location && <div className="text-neutral-600">📍 {selected.location}</div>}
            {selected.courseTitle && <div className="text-neutral-500">Course: {selected.courseTitle}</div>}
            {selected.description && <p className="whitespace-pre-wrap text-neutral-700">{selected.description}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
