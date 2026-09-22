import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Inbox, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { invokeFn } from '../../lib/functions';
import { answerValueToStrings, looksLikeLinks, topAnswerRows } from '../../lib/formAnalytics';
import { FormFieldStatsGrid, type FieldStat } from '../../components/FormFieldStats';
import { AnswerValue } from '../../components/FormAnswerValue';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, Checkbox, EmptyState, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';

const PAYMENT_AMOUNTS = [2000, 5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 100000];

interface Registration {
  id: string;
  source: 'registration_form' | 'google_form' | 'csv';
  full_name: string;
  email: string;
  phone: string | null;
  answers: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  requested_course_id: string | null;
  payment_status: 'unpaid' | 'paid' | 'waived';
  payment_amount: number | null;
  payment_ref: string | null;
  payment_method: string | null;
  form: { title: string } | null;
  requested_course: { id: string; title: string } | null;
  reviewer: { full_name: string; email: string } | null;
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
  const [showAnalytics, setShowAnalytics] = useState(false);

  const q = useQuery<{
    rows: Registration[];
    groups: { id: string; name: string }[];
    groupCourses: { group_id: string; course_id: string }[];
  }>(async () => {
    let sel = supabase
      .from('registrations')
      .select(
        'id, source, full_name, email, phone, answers, status, review_note, reviewed_at, created_at, requested_course_id, ' +
          'payment_status, payment_amount, payment_ref, payment_method, ' +
          'form:enrollment_forms(title), requested_course:courses(id, title), ' +
          'reviewer:profiles!registrations_reviewed_by_fkey(full_name, email)',
      )
      .order('created_at', { ascending: false });
    if (filter !== 'all') sel = sel.eq('status', filter);
    const [rows, groups, groupCourses] = await Promise.all([
      unwrap(sel) as Promise<Registration[]>,
      unwrap(supabase.from('course_groups').select('id, name').order('name')) as Promise<{ id: string; name: string }[]>,
      unwrap(supabase.from('course_group_courses').select('group_id, course_id')) as Promise<
        { group_id: string; course_id: string }[]
      >,
    ]);
    return { rows, groups, groupCourses };
  }, [filter]);

  const pendingCount = useMemo(() => q.data?.rows.filter((r) => r.status === 'pending').length ?? 0, [q.data]);

  // Dynamic analytics over whatever custom fields these registrations actually carry — not tied to one
  // form's schema, since rows here can come from our form, a Google Form, or a CSV import.
  const analyticsStats = useMemo<FieldStat[]>(() => {
    const rows = q.data?.rows ?? [];
    const order: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      for (const key of Object.keys(r.answers ?? {})) {
        if (!seen.has(key)) {
          seen.add(key);
          order.push(key);
        }
      }
    }
    return order
      .map((label) => {
        const values = rows.flatMap((r) => answerValueToStrings((r.answers ?? {})[label]));
        if (!values.length || looksLikeLinks(values)) return null;
        const counts = new Map<string, number>();
        for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
        return { key: label, label, total: values.length, rows: topAnswerRows(counts) };
      })
      .filter((s): s is FieldStat => s !== null);
  }, [q.data]);

  // Ad-hoc filter by a single custom field/value — e.g. "Academic Branch" = "EEE" — built the same
  // dynamic way as the analytics above, from whatever fields these registrations actually carry.
  const [fieldFilterKey, setFieldFilterKey] = useState('');
  const [fieldFilterValue, setFieldFilterValue] = useState('');

  const filterableFields = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const order: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      for (const key of Object.keys(r.answers ?? {})) {
        if (!seen.has(key)) {
          seen.add(key);
          order.push(key);
        }
      }
    }
    return order;
  }, [q.data]);

  const fieldValueOptions = useMemo(() => {
    if (!fieldFilterKey) return [];
    const counts = new Map<string, number>();
    for (const r of q.data?.rows ?? []) {
      for (const v of answerValueToStrings((r.answers ?? {})[fieldFilterKey])) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [q.data, fieldFilterKey]);

  const filteredRows = useMemo(() => {
    const rows = q.data?.rows ?? [];
    if (!fieldFilterKey || !fieldFilterValue) return rows;
    return rows.filter((r) => answerValueToStrings((r.answers ?? {})[fieldFilterKey]).includes(fieldFilterValue));
  }, [q.data, fieldFilterKey, fieldFilterValue]);

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
            <Button variant="secondary" onClick={() => setShowAnalytics(true)}>
              <BarChart3 size={14} /> Form analytics
            </Button>
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

      {!!filterableFields.length && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            value={fieldFilterKey}
            onChange={(e) => {
              setFieldFilterKey(e.target.value);
              setFieldFilterValue('');
            }}
            className="w-52"
          >
            <option value="">Filter by field…</option>
            {filterableFields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
          {fieldFilterKey && (
            <Select value={fieldFilterValue} onChange={(e) => setFieldFilterValue(e.target.value)} className="w-52">
              <option value="">Any value</option>
              {fieldValueOptions.map(([value, count]) => (
                <option key={value} value={value}>
                  {value} ({count})
                </option>
              ))}
            </Select>
          )}
          {(fieldFilterKey || fieldFilterValue) && (
            <button
              onClick={() => {
                setFieldFilterKey('');
                setFieldFilterValue('');
              }}
              className="text-xs text-neutral-400 hover:text-neutral-700"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {q.loading ? (
        <Spinner />
      ) : !q.data?.rows.length ? (
        <EmptyState
          icon={<Inbox size={22} />}
          title="Nothing here"
          description="Registrations from your public form or a linked Google Form will show up here. You can also import a CSV."
        />
      ) : !filteredRows.length ? (
        <EmptyState
          icon={<Inbox size={22} />}
          title="No matches"
          description={`Nobody in this filter has "${fieldFilterKey}" = "${fieldFilterValue}".`}
        />
      ) : (
        <GlassCard className="divide-y divide-white/50 p-2">
          {filteredRows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-medium text-neutral-900">{r.full_name || '—'}</div>
                <div className="text-sm text-neutral-500">
                  {r.email} · {new Date(r.created_at).toLocaleDateString()}
                </div>
                {r.reviewer && (
                  <div className="text-xs text-neutral-400">
                    {r.status === 'accepted' ? 'Accepted' : 'Reviewed'} by {r.reviewer.full_name || r.reviewer.email}
                    {r.reviewed_at ? ` · ${new Date(r.reviewed_at).toLocaleDateString()}` : ''}
                  </div>
                )}
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

      <Modal open={showAnalytics} onClose={() => setShowAnalytics(false)} title="Form analytics" wide>
        <p className="-mt-2 mb-4 text-sm text-neutral-500">
          Based on the {q.data?.rows.length ?? 0} registration{q.data?.rows.length === 1 ? '' : 's'} matching the “{filter}” filter above — covering
          every custom field these forms collected, from Gender to Branch to Semester.
        </p>
        <FormFieldStatsGrid stats={analyticsStats} />
      </Modal>

      {viewing && q.data && (
        <ReviewModal
          reg={viewing}
          groups={q.data.groups}
          groupCourses={q.data.groupCourses}
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
  groups,
  groupCourses,
  writable,
  onClose,
  onReject,
  onAccepted,
}: {
  reg: Registration;
  groups: { id: string; name: string }[];
  groupCourses: { group_id: string; course_id: string }[];
  writable: boolean;
  onClose: () => void;
  onReject: (r: Registration, note: string) => void;
  onAccepted: () => void;
}) {
  const toast = useToast();
  // Pre-select whichever group(s) already contain the course this person requested,
  // so the common case (one requested course, that course lives in one workshop
  // group) needs no extra clicking.
  const [selectedGroups, setSelectedGroups] = useState<string[]>([
    ...new Set(groupCourses.filter((gc) => gc.course_id === reg.requested_course_id).map((gc) => gc.group_id)),
  ]);
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
        course_group_ids: selectedGroups,
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
                  <Select value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })}>
                    <option value="">Amount ₹</option>
                    {PAYMENT_AMOUNTS.map((a) => (
                      <option key={a} value={a}>
                        ₹{a.toLocaleString('en-IN')}
                      </option>
                    ))}
                  </Select>
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
                <div className="mb-1.5 text-sm font-medium text-neutral-700">Grant access to a course group</div>
                <p className="mb-2 text-xs text-neutral-400">
                  Access is granted per workshop bundle, not per individual course — checking a group enrolls this
                  student in every course it currently contains, and keeps them enrolled in any course added to it
                  later.
                </p>
                {!groups.length ? (
                  <p className="text-sm text-neutral-400">
                    No course groups yet —{' '}
                    <Link to="/admin/course-groups" className="text-blue-600 underline">
                      create one first
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {groups.map((g) => {
                      const count = groupCourses.filter((gc) => gc.group_id === g.id).length;
                      return (
                        <Checkbox
                          key={g.id}
                          label={`${g.name} (${count} course${count === 1 ? '' : 's'})`}
                          checked={selectedGroups.includes(g.id)}
                          onChange={(e) =>
                            setSelectedGroups((s) => (e.target.checked ? [...s, g.id] : s.filter((x) => x !== g.id)))
                          }
                        />
                      );
                    })}
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
              {reg.status === 'accepted' ? 'Accepted' : 'Rejected'}
              {reg.reviewer ? ` by ${reg.reviewer.full_name || reg.reviewer.email}` : ''}
              {reg.reviewed_at ? ` on ${new Date(reg.reviewed_at).toLocaleString()}` : ''}.
              {reg.review_note ? ` Note: ${reg.review_note}` : ''}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
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
