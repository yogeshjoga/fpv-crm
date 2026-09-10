import { useMemo, useRef, useState } from 'react';
import { Inbox, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { invokeFn } from '../../lib/functions';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';

interface Registration {
  id: string;
  source: 'registration_form' | 'google_form' | 'csv';
  full_name: string;
  email: string;
  phone: string | null;
  answers: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected';
  review_note: string | null;
  created_at: string;
  requested_course_id: string | null;
  form: { title: string } | null;
  requested_course: { id: string; title: string } | null;
}

const SOURCE_LABEL: Record<Registration['source'], string> = {
  registration_form: 'our form',
  google_form: 'Google Form',
  csv: 'CSV',
};

export function Registrations() {
  const { profile } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'rejected' | 'all'>('pending');
  const [viewing, setViewing] = useState<Registration | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const q = useQuery<{ rows: Registration[]; courses: { id: string; title: string }[] }>(async () => {
    let sel = supabase
      .from('registrations')
      .select(
        'id, source, full_name, email, phone, answers, status, review_note, created_at, requested_course_id, ' +
          'form:enrollment_forms(title), requested_course:courses(id, title)',
      )
      .order('created_at', { ascending: false });
    if (filter !== 'all') sel = sel.eq('status', filter);
    const [rows, courses] = await Promise.all([
      unwrap(sel) as Promise<Registration[]>,
      unwrap(supabase.from('courses').select('id, title').order('title')) as Promise<{ id: string; title: string }[]>,
    ]);
    return { rows, courses };
  }, [filter]);

  const pendingCount = useMemo(() => q.data?.rows.filter((r) => r.status === 'pending').length ?? 0, [q.data]);

  const reject = async (r: Registration, note: string) => {
    const { error } = await supabase
      .from('registrations')
      .update({ status: 'rejected', reviewed_by: profile!.id, reviewed_at: new Date().toISOString(), review_note: note || null })
      .eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast('Registration rejected');
    setViewing(null);
    q.refetch();
  };

  const onCsv = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error('No rows found in the CSV.');
      const res = await invokeFn<{ inserted: number; skipped: number }>('register', { source: 'csv', rows });
      toast(`Imported ${res.inserted}, skipped ${res.skipped}`);
      q.refetch();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <PageHeader
        title="Registrations"
        subtitle={`${pendingCount} awaiting review`}
        actions={
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-white">
              {importing ? '…' : <Upload size={14} />} Import CSV
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])}
              />
            </label>
            <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-36">
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </Select>
          </div>
        }
      />

      {q.loading ? (
        <Spinner />
      ) : !q.data?.rows.length ? (
        <EmptyState
          icon={<Inbox size={22} />}
          title="Nothing here"
          description="Registrations from your public form or a linked Google Form will show up here. You can also import a CSV."
        />
      ) : (
        <GlassCard className="divide-y divide-white/50 p-2">
          {q.data.rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-medium text-neutral-900">{r.full_name || '—'}</div>
                <div className="text-sm text-neutral-500">
                  {r.email} · {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{SOURCE_LABEL[r.source]}</Badge>
                <Badge tone={r.status === 'accepted' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status}</Badge>
                <Button variant="secondary" onClick={() => setViewing(r)}>
                  Review
                </Button>
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      {viewing && q.data && (
        <ReviewModal
          reg={viewing}
          courses={q.data.courses}
          onClose={() => setViewing(null)}
          onReject={reject}
          onAccepted={() => {
            setViewing(null);
            q.refetch();
          }}
        />
      )}
    </div>
  );
}

function ReviewModal({
  reg,
  courses,
  onClose,
  onReject,
  onAccepted,
}: {
  reg: Registration;
  courses: { id: string; title: string }[];
  onClose: () => void;
  onReject: (r: Registration, note: string) => void;
  onAccepted: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>(reg.requested_course_id ? [reg.requested_course_id] : []);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<{ email: string; temp_password: string | null; email_sent: boolean } | null>(null);

  const accept = async () => {
    setBusy(true);
    try {
      const res = await invokeFn<{ email: string; temp_password: string | null; email_sent: boolean; granted_courses: number }>(
        'accept-registration',
        { registration_id: reg.id, course_ids: selected, review_note: note },
      );
      if (res.email_sent) {
        toast(`Account created, ${res.granted_courses} course(s) granted, credentials emailed`);
        onAccepted();
      } else {
        setCreds({ email: res.email, temp_password: res.temp_password, email_sent: res.email_sent });
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const answers = Object.entries(reg.answers ?? {});

  return (
    <Modal open onClose={onClose} title="Review registration" wide>
      {creds ? (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Account created. Email delivery isn’t configured yet — share these credentials with the student:
          </p>
          <div className="rounded-2xl border border-white/60 bg-white/50 p-4 text-sm">
            <div>
              <span className="text-neutral-500">Email:</span> <span className="font-mono">{creds.email}</span>
            </div>
            <div>
              <span className="text-neutral-500">Temp password:</span>{' '}
              <span className="font-mono font-semibold">{creds.temp_password}</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onAccepted}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm">
            <div className="font-medium text-neutral-900">{reg.full_name}</div>
            <div className="text-neutral-500">{reg.email}{reg.phone ? ` · ${reg.phone}` : ''}</div>
            {reg.form?.title && <div className="mt-1 text-neutral-500">Form: {reg.form.title}</div>}
          </div>

          {!!answers.length && (
            <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
              <dl className="space-y-2 text-sm">
                {answers.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[160px_1fr] gap-3">
                    <dt className="text-neutral-500">{k}</dt>
                    <dd className="text-neutral-900">
                      <AnswerValue value={v} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {reg.status === 'pending' ? (
            <>
              <div>
                <div className="mb-1.5 text-sm font-medium text-neutral-700">Grant access to courses</div>
                {!courses.length ? (
                  <p className="text-sm text-neutral-400">No courses yet — create one first.</p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {courses.map((c) => (
                      <Checkbox
                        key={c.id}
                        label={c.title}
                        checked={selected.includes(c.id)}
                        onChange={(e) =>
                          setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
              <TextInput placeholder="Review note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="danger" onClick={() => onReject(reg, note)}>
                  Reject
                </Button>
                <Button onClick={accept} loading={busy}>
                  Accept &amp; create account
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              {reg.status === 'accepted' ? 'Accepted.' : 'Rejected.'}
              {reg.review_note ? ` Note: ${reg.review_note}` : ''}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

const DRIVE_ID = /^[A-Za-z0-9_-]{25,}$/;

function driveLink(id: string) {
  return `https://drive.google.com/file/d/${id}/view`;
}
function driveThumb(id: string) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w320`;
}

/** Renders a form answer: linkifies URLs and Google Drive file IDs, previews images. */
function AnswerValue({ value }: { value: unknown }) {
  const parts = Array.isArray(value) ? value : [value];
  const rendered = parts
    .map((raw) => String(raw ?? '').trim())
    .filter(Boolean)
    .map((v, i) => {
      const idMatch = DRIVE_ID.test(v);
      const isUrl = /^https?:\/\//i.test(v);
      const driveIdInUrl = isUrl ? v.match(/[-\w]{25,}/)?.[0] : null;
      if (idMatch || driveIdInUrl) {
        const id = idMatch ? v : (driveIdInUrl as string);
        return (
          <a key={i} href={isUrl ? v : driveLink(id)} target="_blank" rel="noreferrer" className="inline-block">
            <img
              src={driveThumb(id)}
              alt="upload"
              className="h-20 w-20 rounded-lg border border-white/60 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).replaceWith(
                  Object.assign(document.createElement('span'), {
                    className: 'text-blue-600 underline text-xs',
                    textContent: 'Open file',
                  }),
                );
              }}
            />
          </a>
        );
      }
      if (isUrl)
        return (
          <a key={i} href={v} target="_blank" rel="noreferrer" className="break-all text-blue-600 underline">
            {v}
          </a>
        );
      return <span key={i}>{v}</span>;
    });
  if (!rendered.length) return <>—</>;
  return <div className="flex flex-wrap items-center gap-2">{rendered}</div>;
}

/** Minimal CSV parser: first row = headers. name/full name, email, phone are mapped; the rest go to answers. */
function parseCsv(text: string): { full_name: string; email: string; phone?: string; answers: Record<string, string> }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (l: string) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.slice(0, -1).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'full name' || h === 'full_name');
  const emailIdx = headers.findIndex((h) => h.includes('email'));
  const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile'));
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const answers: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (i !== nameIdx && i !== emailIdx && i !== phoneIdx && cells[i]) answers[headers[i]] = cells[i];
    });
    return {
      full_name: nameIdx >= 0 ? cells[nameIdx] ?? '' : '',
      email: emailIdx >= 0 ? cells[emailIdx] ?? '' : '',
      phone: phoneIdx >= 0 ? cells[phoneIdx] : undefined,
      answers,
    };
  });
}
