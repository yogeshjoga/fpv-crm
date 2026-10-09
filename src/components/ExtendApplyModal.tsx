import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Field, Modal, TextInput, useToast } from './ui/kit';
import { fmtDateTime, toLocalInput } from '../lib/careers';

export interface ExtendableJob {
  id: string;
  title: string;
  status: string;
  apply_starts_at: string | null;
  apply_ends_at: string | null;
}

const DAY = 24 * 3600_000;
const CHOICES: [string, number][] = [
  ['1 day', 1],
  ['3 days', 3],
  ['1 week', 7],
  ['2 weeks', 14],
  ['1 month', 30],
];

/**
 * Give a position more time to receive applications, or open one that already closed again.
 * The new closing time counts from now, or from the current closing time if that is still ahead.
 * Students get the usual "position open" notification again, with the new closing time.
 */
export function ExtendApplyModal({ job, onClose, onDone }: { job: ExtendableJob; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const base = Math.max(Date.now(), job.apply_ends_at ? new Date(job.apply_ends_at).getTime() : 0);
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(base + 7 * DAY).toISOString()));

  const save = async () => {
    const end = new Date(endsAt);
    if (!endsAt || Number.isNaN(end.getTime())) return toast('Pick a closing date and time', 'error');
    if (end.getTime() <= Date.now()) return toast('The closing time must be in the future', 'error');
    if (job.apply_starts_at && end.getTime() <= new Date(job.apply_starts_at).getTime()) return toast('The closing time must be after the opening time', 'error');
    setBusy(true);
    const { error } = await supabase.from('careers_jobs').update({ status: 'open', apply_ends_at: end.toISOString() }).eq('id', job.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Extended. Students have been notified');
    onDone();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Extend "${job.title}"`}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          {job.apply_ends_at ? <>Applications {new Date(job.apply_ends_at).getTime() > Date.now() ? 'close' : 'closed'} on <span className="font-medium text-neutral-900">{fmtDateTime(job.apply_ends_at)}</span>.</> : 'This position has no closing time.'}
        </p>
        <div>
          <div className="mb-1.5 text-sm font-medium text-neutral-700">Add more time</div>
          <div className="flex flex-wrap gap-2">
            {CHOICES.map(([label, days]) => (
              <button
                key={label}
                type="button"
                onClick={() => setEndsAt(toLocalInput(new Date(base + days * DAY).toISOString()))}
                className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-black/5 hover:bg-white"
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
        <Field label="New closing time" hint="Counts from now, or from the current closing time if it is still ahead. You can also pick any date.">
          <TextInput type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
        <p className="rounded-xl bg-blue-50/80 px-3 py-2 text-xs text-blue-900">The position is opened again if it was closed, and every active student and staff member gets a Careers notification with the new closing time.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            <CalendarPlus size={15} /> Extend and notify
          </Button>
        </div>
      </div>
    </Modal>
  );
}
