import { useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
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
  payment_status: 'unpaid' | 'paid' | 'waived';
  payment_amount: number | null;
  payment_ref: string | null;
  payment_method: string | null;
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
  const { canWrite } = useAdminAccess();
  const writable = canWrite('registrations');
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
          'payment_status, payment_amount, payment_ref, payment_method, ' +
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
            {writable && (
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
            )}
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
                <Badge tone={r.payment_status === 'unpaid' ? 'neutral' : 'green'}>
                  {r.payment_status === 'waived' ? 'fee waived' : r.payment_status}
                </Badge>
                <Badge tone={r.status === 'accepted' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status}</Badge>
                <Button variant="secondary" onClick={() => setViewing(r)}>
                  {writable ? 'Review' : 'View'}
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
          writable={writable}
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
  writable,
  onClose,
  onReject,
  onAccepted,
}: {
  reg: Registration;
  courses: { id: string; title: string }[];
  writable: boolean;
  onClose: () => void;
  onReject: (r: Registration, note: string) => void;
  onAccepted: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>(reg.requested_course_id ? [reg.requested_course_id] : []);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<{ email: string; temp_password: string | null; email_skip?: string | null } | null>(null);
  const [pay, setPay] = useState({
    status: reg.payment_status,
    amount: reg.payment_amount != null ? String(reg.payment_amount) : '',
    ref: reg.payment_ref ?? '',
    method: reg.payment_method ?? 'UPI',
  });

  const paymentPayload = () => ({
    status: pay.status,
    amount: pay.amount ? Number(pay.amount) : null,
    ref: pay.ref || null,
    method: pay.method || null,
  });

  const savePayment = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('registrations')
      .update({
        payment_status: pay.status,
        payment_amount: pay.amount ? Number(pay.amount) : null,
        payment_ref: pay.ref || null,
        payment_method: pay.method || null,
        paid_at: pay.status === 'paid' ? new Date().toISOString() : null,
      })
      .eq('id', reg.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Payment saved');
    onAccepted();
  };

  const accept = async () => {
    setBusy(true);
    try {
      const res = await invokeFn<{
        email: string;
        temp_password: string | null;
        email_sent: boolean;
        email_skip?: string | null;
        account_created: boolean;
        granted_courses: number;
      }>('accept-registration', {
        registration_id: reg.id,
        course_ids: selected,
        review_note: note,
        payment: paymentPayload(),
      });

      if (!res.account_created) {
        // email already had an account — we only updated their course access
        toast(
          res.email_sent
            ? `Existing account — access updated, student notified by email`
            : `Existing account — access updated (${res.granted_courses} course(s))`,
        );
        onAccepted();
      } else if (res.email_sent) {
        toast(`Account created, ${res.granted_courses} course(s) granted — credentials emailed`);
        onAccepted();
      } else {
        // new account, but the email didn't go out — surface the credentials to hand over
        setCreds({ email: res.email, temp_password: res.temp_password, email_skip: res.email_skip });
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
            Account created, but the welcome email could not be sent
            {creds.email_skip ? ` (${creds.email_skip})` : ''}. Share these credentials with the student:
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

          {reg.status === 'pending' && !writable ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/60 bg-white/40 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Payment</span>
                  <Badge tone={reg.payment_status === 'unpaid' ? 'neutral' : 'green'}>
                    {reg.payment_status === 'waived' ? 'fee waived' : reg.payment_status}
                  </Badge>
                </div>
                {reg.requested_course && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-neutral-500">Requested course</span>
                    <span className="text-neutral-900">{reg.requested_course.title}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-400">You have read-only access to Registrations — a super admin or a write-enabled instructor can accept or reject this.</p>
            </div>
          ) : reg.status === 'pending' ? (
            <>
              <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
                <div className="mb-2 text-sm font-medium text-neutral-700">Payment</div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Select value={pay.status} onChange={(e) => setPay({ ...pay, status: e.target.value as typeof pay.status })}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="waived">Fee waived</option>
                  </Select>
                  <TextInput type="number" placeholder="Amount ₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                  <TextInput placeholder="Reference / UTR" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} />
                  <Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                    <option>UPI</option>
                    <option>Bank transfer</option>
                    <option>Card</option>
                    <option>Cash</option>
                    <option>Other</option>
                  </Select>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    {pay.status === 'unpaid' ? 'Record payment (or waive) before you can accept.' : 'Ready to accept.'}
                  </span>
                  <Button variant="ghost" onClick={savePayment} loading={busy}>
                    Save payment only
                  </Button>
                </div>
              </div>

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
                <Button onClick={accept} loading={busy} disabled={pay.status === 'unpaid'}>
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

/** Preview a file stored in our enrollment-uploads bucket via a signed URL. */
function StoredFilePreview({ path, name, mime }: { path: string; name?: string; mime?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    supabase.storage
      .from('enrollment-uploads')
      .createSignedUrl(path, 600)
      .then(({ data }) => live && setUrl(data?.signedUrl ?? null));
    return () => {
      live = false;
    };
  }, [path]);

  if (!url) return <span className="text-xs text-neutral-400">loading…</span>;
  const isImage = (mime ?? '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name ?? '');
  if (isImage && !failed) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={name ?? 'upload'}
          className="max-h-40 rounded-lg border border-white/60 object-contain"
          onError={() => setFailed(true)}
        />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
      {name ?? 'Download file'}
    </a>
  );
}

/** Renders a form answer: previews stored files, linkifies URLs and Drive IDs. */
function AnswerValue({ value }: { value: unknown }) {
  if (value && typeof value === 'object' && '__file' in (value as Record<string, unknown>)) {
    const f = value as { __file: string; name?: string; mime?: string };
    return <StoredFilePreview path={f.__file} name={f.name} mime={f.mime} />;
  }
  const parts = Array.isArray(value) ? value : [value];
  const rendered = parts
    .map((raw) => (raw && typeof raw === 'object' && '__file' in raw ? raw : String(raw ?? '').trim()))
    .filter((x) => x && (typeof x !== 'string' || x.length))
    .map((v, i) => {
      if (v && typeof v === 'object' && '__file' in v) {
        const f = v as { __file: string; name?: string; mime?: string };
        return <StoredFilePreview key={i} path={f.__file} name={f.name} mime={f.mime} />;
      }
      const s = v as string;
      return renderScalar(s, i);
    });
  if (!rendered.length) return <>—</>;
  return <div className="flex flex-wrap items-center gap-2">{rendered}</div>;
}

function renderScalar(v: string, i: number) {
  const idMatch = DRIVE_ID.test(v);
  const isUrl = /^https?:\/\//i.test(v);
  const driveIdInUrl = isUrl ? v.match(/\/d\/([-\w]{25,})/)?.[1] ?? null : null;
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
