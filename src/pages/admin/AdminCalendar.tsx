import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { CalendarView } from '../../components/CalendarView';
import type { CalEvent } from '../../components/CalendarView';
import { Button, Field, Modal, PageHeader, Select, Spinner, TextArea, TextInput, useToast, Checkbox } from '../../components/ui/kit';

const TYPES = ['session', 'exam_window', 'deadline', 'holiday', 'other'] as const;

interface Draft {
  id: string | null;
  title: string;
  description: string;
  type: (typeof TYPES)[number];
  date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string;
  course_id: string;
}

const emptyDraft = (date = ''): Draft => ({
  id: null,
  title: '',
  description: '',
  type: 'session',
  date: date || new Date().toISOString().slice(0, 10),
  start_time: '10:00',
  end_time: '11:00',
  all_day: false,
  location: '',
  course_id: '',
});

export function AdminCalendar() {
  const { profile } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);

  const q = useQuery(async () => {
    const [rows, courses] = await Promise.all([
      unwrap(
        supabase
          .from('calendar_events')
          .select('id, title, description, type, starts_at, ends_at, all_day, location, course_id, course:courses(title)')
          .order('starts_at'),
      ) as Promise<any[]>,
      unwrap(supabase.from('courses').select('id, title').order('title')) as Promise<any[]>,
    ]);
    return { events: rows.map((r) => ({ ...r, courseTitle: r.course?.title ?? null })) as (CalEvent & { course_id: string | null })[], courses };
  }, []);

  const openEdit = (e: any) => {
    const s = new Date(e.starts_at);
    const en = e.ends_at ? new Date(e.ends_at) : null;
    setDraft({
      id: e.id,
      title: e.title,
      description: e.description ?? '',
      type: e.type,
      date: s.toISOString().slice(0, 10),
      start_time: s.toTimeString().slice(0, 5),
      end_time: en ? en.toTimeString().slice(0, 5) : '',
      all_day: e.all_day,
      location: e.location ?? '',
      course_id: e.course_id ?? '',
    });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return toast('Title is required', 'error');
    const starts_at = draft.all_day ? new Date(`${draft.date}T00:00`).toISOString() : new Date(`${draft.date}T${draft.start_time}`).toISOString();
    const ends_at = draft.all_day
      ? null
      : draft.end_time
        ? new Date(`${draft.date}T${draft.end_time}`).toISOString()
        : null;
    const payload = {
      title: draft.title,
      description: draft.description,
      type: draft.type,
      starts_at,
      ends_at,
      all_day: draft.all_day,
      location: draft.location,
      course_id: draft.course_id || null,
    };
    const res = draft.id
      ? await supabase.from('calendar_events').update(payload).eq('id', draft.id)
      : await supabase.from('calendar_events').insert({ ...payload, created_by: profile!.id });
    if (res.error) return toast(res.error.message, 'error');
    toast('Saved');
    setDraft(null);
    q.refetch();
  };

  const del = async () => {
    if (!draft?.id) return;
    if (!confirm('Delete this event?')) return;
    await supabase.from('calendar_events').delete().eq('id', draft.id);
    setDraft(null);
    q.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Plan sessions, exam windows, deadlines and holidays"
        actions={
          <Button onClick={() => setDraft(emptyDraft())}>
            <Plus size={16} /> New event
          </Button>
        }
      />
      {q.loading ? (
        <Spinner />
      ) : (
        <CalendarView events={q.data!.events} onEventClick={openEdit} onAddOnDay={(iso) => setDraft(emptyDraft(iso))} />
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit event' : 'New event'} wide>
        {draft && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Title" required>
                <TextInput value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </Field>
            </div>
            <Field label="Type">
              <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft['type'] })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </Select>
            </Field>
            <Field label="Course (optional)">
              <Select value={draft.course_id} onChange={(e) => setDraft({ ...draft, course_id: e.target.value })}>
                <option value="">Org-wide (all students)</option>
                {q.data!.courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <TextInput type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox label="All day" checked={draft.all_day} onChange={(e) => setDraft({ ...draft, all_day: e.target.checked })} />
            </div>
            {!draft.all_day && (
              <>
                <Field label="Start time">
                  <TextInput type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} />
                </Field>
                <Field label="End time">
                  <TextInput type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} />
                </Field>
              </>
            )}
            <div className="sm:col-span-2">
              <Field label="Location">
                <TextInput value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Online / room / address" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description">
                <TextArea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2 flex justify-between">
              {draft.id ? (
                <Button variant="ghost" onClick={del}>
                  <Trash2 size={14} /> Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                <Button onClick={save}>Save event</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
