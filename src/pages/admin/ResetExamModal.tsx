import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Checkbox, Modal, Select, TextInput, useToast } from '../../components/ui/kit';
import type { Tables } from '../../lib/database.types';

type Course = Tables<'courses'>;

export interface ResetStudent {
  id: string;
  name: string;
  email: string;
}

interface Preview {
  students: number;
  attempts: number;
  marks: number;
  certified_students: number;
  skipped_certified: number;
}

const PARTS = [
  { key: 'online', label: 'Online exam', hint: 'attempts and answers; the student can take it again from scratch', composite: false },
  { key: 'viva', label: 'Viva marks', hint: '', composite: true },
  { key: 'simulation', label: 'Simulation marks', hint: '', composite: true },
  { key: 'piloting', label: 'Free flight marks', hint: '', composite: true },
] as const;
type PartKey = (typeof PARTS)[number]['key'];

/**
 * Start a course's exam fresh: wipe the online exam attempts and/or the viva, simulation and free flight marks,
 * for everyone or for one student. The numbers shown come from a dry run on the server, so nothing is a surprise.
 */
export function ResetExamModal({
  course,
  composite,
  students,
  onClose,
  onDone,
}: {
  course: Course;
  composite: boolean;
  students: ResetStudent[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const available = PARTS.filter((p) => composite || !p.composite);
  const [parts, setParts] = useState<Record<PartKey, boolean>>({ online: false, viva: false, simulation: false, piloting: false });
  const [scope, setScope] = useState<'all' | 'one'>('all');
  const [studentId, setStudentId] = useState('');
  const [revoke, setRevoke] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = available.filter((p) => parts[p.key]);
  const target = scope === 'all' ? null : studentId || null;
  const ready = chosen.length > 0 && (scope === 'all' || !!studentId);

  const call = (dry: boolean) =>
    supabase.rpc('reset_exam_data', {
      p_course_id: course.id,
      p_student_id: target as string,
      p_online: parts.online,
      p_viva: parts.viva,
      p_simulation: parts.simulation,
      p_piloting: parts.piloting,
      p_revoke_certs: revoke,
      p_dry_run: dry,
    });

  // what would be removed, recalculated whenever the choices change
  useEffect(() => {
    if (!ready) {
      setPreview(null);
      return;
    }
    let live = true;
    call(true).then(({ data, error }) => {
      if (live && !error) setPreview(data as unknown as Preview);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, scope, studentId, revoke, ready]);

  const run = async () => {
    setBusy(true);
    const { data, error } = await call(false);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    const r = data as unknown as Preview & { certificates_revoked: number };
    toast(
      `Reset done: ${r.attempts} online attempt${r.attempts === 1 ? '' : 's'} and ${r.marks} mark${r.marks === 1 ? '' : 's'} cleared` +
        (r.certificates_revoked ? `, ${r.certificates_revoked} certificate${r.certificates_revoked === 1 ? '' : 's'} revoked` : ''),
    );
    onDone();
    onClose();
  };

  const set = (k: PartKey, v: boolean) => setParts((p) => ({ ...p, [k]: v }));
  const everything = () => setParts({ online: true, viva: composite, simulation: composite, piloting: composite });

  return (
    <Modal open onClose={onClose} title={`Reset exam — ${course.title}`} wide>
      <p className="text-sm text-neutral-600">
        Use this to start fresh. Pick what to clear, and who it applies to. This cannot be undone, so check the numbers below first.
      </p>

      <div className="mt-4 text-sm font-medium text-neutral-800">What to reset</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {available.map((p) => (
          <div key={p.key} className="rounded-xl border border-white/60 bg-white/40 px-3 py-2">
            <Checkbox label={p.label} checked={parts[p.key]} onChange={(e) => set(p.key, e.target.checked)} />
            {p.hint && <div className="ml-6 mt-0.5 text-xs text-neutral-400">{p.hint}</div>}
          </div>
        ))}
      </div>
      {available.length > 1 && (
        <button type="button" onClick={everything} className="mt-2 text-xs font-medium text-blue-600 hover:underline">
          Select everything
        </button>
      )}

      <div className="mt-5 text-sm font-medium text-neutral-800">Who</div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-neutral-700">
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /> Everyone in this course ({students.length})
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === 'one'} onChange={() => setScope('one')} /> One student
        </label>
      </div>
      {scope === 'one' && (
        <div className="mt-2 max-w-md">
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Choose a student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.email}
              </option>
            ))}
          </Select>
        </div>
      )}

      {ready && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {preview ? (
            <>
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={15} /> This will clear
              </div>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {parts.online && (
                  <li>
                    {preview.attempts} online exam attempt{preview.attempts === 1 ? '' : 's'}
                  </li>
                )}
                {(parts.viva || parts.simulation || parts.piloting) && (
                  <li>
                    {preview.marks} entered mark{preview.marks === 1 ? '' : 's'} ({chosen.filter((p) => p.key !== 'online').map((p) => p.label.replace(' marks', '').toLowerCase()).join(', ')})
                  </li>
                )}
                <li>
                  across {preview.students} student{preview.students === 1 ? '' : 's'}
                </li>
              </ul>
              {preview.certified_students > 0 && (
                <div className="mt-2 text-xs">
                  {preview.certified_students} student{preview.certified_students === 1 ? ' holds' : 's hold'} an issued certificate.{' '}
                  {revoke ? 'Their certificates will be revoked.' : 'They are skipped and keep everything.'}
                </div>
              )}
            </>
          ) : (
            <span className="text-xs">Checking what would be cleared…</span>
          )}
        </div>
      )}

      {ready && preview && preview.certified_students > 0 && (
        <div className="mt-3">
          <Checkbox label="Also revoke their issued certificates, and reset them too" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} />
        </div>
      )}

      {ready && (
        <div className="mt-5">
          <div className="text-xs text-neutral-500">
            Type <span className="font-mono font-semibold text-neutral-800">RESET</span> to confirm
          </div>
          <TextInput className="mt-1 max-w-xs" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESET" />
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={run} loading={busy} disabled={!ready || confirmText.trim() !== 'RESET' || !preview}>
          Reset now
        </Button>
      </div>
    </Modal>
  );
}
