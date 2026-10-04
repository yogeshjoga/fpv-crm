import { useMemo, useState } from 'react';
import { Check, Download, MessageSquareHeart, Pencil, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { downloadCsv } from '../../lib/csv';
import { slugify } from '../../lib/slug';
import { GlassCard } from '../../components/ui/shared';
import { StarRating } from '../../components/StarRating';
import { Badge, Button, EmptyState, Modal, PageHeader, Select, Spinner, useToast } from '../../components/ui/kit';

interface ReviewRow {
  id: string;
  rating: number;
  comment: string;
  group_id: string | null;
  created_at: string;
  updated_at: string;
  student: { full_name: string; email: string } | null;
  group: { name: string } | null;
}
interface EditRequestRow {
  id: string;
  reason: string;
  status: 'pending' | 'approved';
  created_at: string;
  student: { full_name: string; email: string } | null;
  review: { rating: number; comment: string; group: { name: string } | null } | null;
}

export function AdminReviews() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('reviews');
  const [group, setGroup] = useState('all');
  const [stars, setStars] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [withNames, setWithNames] = useState(true);

  const q = useQuery(
    () =>
      unwrap(
        supabase
          .from('reviews')
          .select(
            'id, rating, comment, group_id, created_at, updated_at, student:profiles!reviews_student_id_fkey(full_name, email), group:course_groups(name)',
          )
          .order('updated_at', { ascending: false }),
      ) as unknown as Promise<ReviewRow[]>,
    [],
  );

  // Students can't edit a review on their own: they ask, and an admin decides here.
  const rq = useQuery(
    () =>
      unwrap(
        supabase
          .from('review_edit_requests')
          .select('id, reason, status, created_at, student:profiles!review_edit_requests_student_id_fkey(full_name, email), review:reviews(rating, comment, group:course_groups(name))')
          .in('status', ['pending', 'approved'])
          .order('created_at', { ascending: true }),
      ) as unknown as Promise<EditRequestRow[]>,
    [],
  );
  const requests = rq.data ?? [];
  const pending = requests.filter((r) => r.status === 'pending');
  const approved = requests.filter((r) => r.status === 'approved');

  const decide = async (r: EditRequestRow, status: 'approved' | 'denied') => {
    if (status === 'denied' && r.status === 'pending' && !confirm('Decline this edit request? The review stays as it is.')) return;
    const { error } = await supabase.from('review_edit_requests').update({ status }).eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast(status === 'approved' ? 'Approved — the student can now edit once' : r.status === 'approved' ? 'Approval withdrawn' : 'Request declined');
    rq.refetch();
  };

  const all = useMemo(() => q.data ?? [], [q.data]);
  const groupOptions = useMemo(() => {
    const groups = new Map<string, string>();
    for (const r of all) if (r.group_id && r.group) groups.set(r.group_id, r.group.name);
    return [...groups.entries()];
  }, [all]);

  const rows = useMemo(
    () => all.filter((r) => (group === 'all' || r.group_id === group) && (stars === 'all' || r.rating === Number(stars))),
    [all, group, stars],
  );

  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: rows.filter((r) => r.rating === n).length }));

  // Exports exactly what is on screen: the current group and star filters are applied.
  // Without names the file has no name or email column and only dates (no times), so feedback
  // can be shared or analysed anonymously.
  const exportCsv = () => {
    const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB');
    const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB');
    const edited = (r: ReviewRow) => (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60_000 ? 'Yes' : 'No');
    const headers = withNames
      ? ['Student', 'Email', 'Course group', 'Rating (1-5)', 'Comment', 'Submitted', 'Last updated', 'Edited']
      : ['#', 'Course group', 'Rating (1-5)', 'Comment', 'Submitted', 'Last updated', 'Edited'];
    const body = rows.map((r, i) =>
      withNames
        ? [r.student?.full_name ?? '', r.student?.email ?? '', r.group?.name ?? '', r.rating, r.comment, stamp(r.created_at), stamp(r.updated_at), edited(r)]
        : [i + 1, r.group?.name ?? '', r.rating, r.comment, day(r.created_at), day(r.updated_at), edited(r)],
    );
    const scope = group === 'all' ? 'all-groups' : slugify(groupOptions.find(([id]) => id === group)?.[1] ?? 'group');
    downloadCsv(`reviews-${scope}${withNames ? '' : '-anonymous'}-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
    toast(`Exported ${rows.length} review${rows.length === 1 ? '' : 's'}${withNames ? '' : ' anonymously'}`);
    setExporting(false);
  };

  const remove = async (r: ReviewRow) => {
    if (!confirm('Remove this review? The student will no longer see it.')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast('Review removed');
    q.refetch();
  };

  if (q.loading && !q.data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Reviews"
        subtitle="What each course group says about the program"
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={group} onChange={(e) => setGroup(e.target.value)} className="w-60">
              <option value="all">All course groups</option>
              {groupOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <Select value={stars} onChange={(e) => setStars(e.target.value)} className="w-32">
              <option value="all">All stars</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n > 1 ? 's' : ''}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => setExporting(true)} disabled={!rows.length}>
              <Download size={15} /> Export CSV
            </Button>
          </div>
        }
      />

      {(pending.length > 0 || approved.length > 0) && (
        <GlassCard className="mb-6 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-neutral-900">
            <Pencil size={16} /> Edit requests
            {pending.length > 0 && <Badge tone="amber">{pending.length} waiting</Badge>}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">Reviews are locked. Approving lets that student change their review once; it then locks again.</p>
          <div className="mt-4 space-y-3">
            {[...pending, ...approved].map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/60 bg-white/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-900">{r.student?.full_name || r.student?.email || 'Student'}</span>
                      <Badge tone="amber">{r.review?.group?.name ?? 'Group'}</Badge>
                      {r.status === 'approved' && <Badge tone="green">Approved — waiting for the student</Badge>}
                    </div>
                    <p className="mt-2 text-sm text-neutral-700">
                      <span className="text-neutral-400">Reason: </span>
                      {r.reason}
                    </p>
                    {r.review && (
                      <div className="mt-2 text-xs text-neutral-500">
                        <span className="mr-2 inline-block align-middle">
                          <StarRating value={r.review.rating} size={12} />
                        </span>
                        <span className="line-clamp-2">{r.review.comment || 'No comment'}</span>
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-neutral-400">Asked {new Date(r.created_at).toLocaleString()}</div>
                  </div>
                  {writable && (
                    <div className="flex gap-2">
                      {r.status === 'pending' && (
                        <Button onClick={() => decide(r, 'approved')}>
                          <Check size={14} /> Approve
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => decide(r, 'denied')}>
                        <X size={14} /> {r.status === 'approved' ? 'Withdraw' : 'Decline'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {!all.length ? (
        <EmptyState icon={<MessageSquareHeart size={22} />} title="No reviews yet" description="Students can leave a rating and feedback from Reviews in their sidebar." />
      ) : (
        <>
          <GlassCard className="mb-6 grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="text-center sm:pr-6">
              <div className="text-4xl font-semibold text-neutral-900">{rows.length ? avg.toFixed(1) : '–'}</div>
              <div className="mt-1 flex justify-center">
                <StarRating value={Math.round(avg)} size={16} />
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {rows.length} review{rows.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="space-y-1.5">
              {dist.map((d) => (
                <div key={d.n} className="flex items-center gap-2 text-xs text-neutral-600">
                  <span className="w-3 text-right">{d.n}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/70">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: rows.length ? `${(d.count / rows.length) * 100}%` : 0 }} />
                  </div>
                  <span className="w-6 text-neutral-400">{d.count}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {!rows.length ? (
            <EmptyState icon={<MessageSquareHeart size={22} />} title="No matching reviews" description="Try a different group or star filter." />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <GlassCard key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-900">{r.student?.full_name || r.student?.email || 'Student'}</span>
                        <Badge tone="amber">{r.group?.name ?? 'Group'}</Badge>
                        {new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60_000 && <Badge tone="blue">Edited</Badge>}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <StarRating value={r.rating} size={15} />
                        <span className="text-xs text-neutral-400">{new Date(r.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {writable && (
                      <Button variant="ghost" onClick={() => remove(r)} title="Remove review">
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                  {r.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{r.comment}</p>}
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      {exporting && (
        <Modal open onClose={() => setExporting(false)} title="Export reviews to CSV">
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {rows.length} review{rows.length === 1 ? '' : 's'} will be exported, matching the group and star filters currently selected.
            </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/60 bg-white/50 p-3">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={withNames} onChange={(e) => setWithNames(e.target.checked)} />
              <span>
                <span className="block text-sm font-medium text-neutral-900">Include student names and email addresses</span>
                <span className="block text-xs text-neutral-500">
                  Untick to export anonymously: no name or email column, and only dates instead of exact times. Comments are exported as written, so a
                  student may still name themselves in their text.
                </span>
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setExporting(false)}>
                Cancel
              </Button>
              <Button onClick={exportCsv}>
                <Download size={15} /> Download {withNames ? 'CSV' : 'anonymous CSV'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
