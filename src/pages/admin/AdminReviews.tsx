import { useMemo, useState } from 'react';
import { MessageSquareHeart, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { StarRating } from '../../components/StarRating';
import { Badge, Button, EmptyState, PageHeader, Select, Spinner, useToast } from '../../components/ui/kit';

interface ReviewRow {
  id: string;
  rating: number;
  comment: string;
  course_id: string | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
  student: { full_name: string; email: string } | null;
  course: { title: string } | null;
  group: { name: string } | null;
}

export function AdminReviews() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('reviews');
  const [course, setCourse] = useState('all');
  const [stars, setStars] = useState('all');

  const q = useQuery(
    () =>
      unwrap(
        supabase
          .from('reviews')
          .select(
            'id, rating, comment, course_id, group_id, created_at, updated_at, student:profiles!reviews_student_id_fkey(full_name, email), course:courses(title), group:course_groups(name)',
          )
          .order('updated_at', { ascending: false }),
      ) as unknown as Promise<ReviewRow[]>,
    [],
  );

  const all = useMemo(() => q.data ?? [], [q.data]);
  // Filter keys: 'group:<id>', 'course:<id>' or 'general'.
  const targetOptions = useMemo(() => {
    const groups = new Map<string, string>();
    const courses = new Map<string, string>();
    for (const r of all) {
      if (r.group_id && r.group) groups.set(r.group_id, r.group.name);
      else if (r.course_id && r.course) courses.set(r.course_id, r.course.title);
    }
    return { groups: [...groups.entries()], courses: [...courses.entries()] };
  }, [all]);

  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (course === 'all' ||
            (course === 'general'
              ? !r.course_id && !r.group_id
              : course.startsWith('group:')
                ? r.group_id === course.slice(6)
                : r.course_id === course.slice(7))) &&
          (stars === 'all' || r.rating === Number(stars)),
      ),
    [all, course, stars],
  );

  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: rows.filter((r) => r.rating === n).length }));

  const remove = async (r: ReviewRow) => {
    if (!confirm('Remove this review? The student will no longer see it.')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast('Review removed');
    q.refetch();
  };

  if (q.loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Reviews"
        subtitle="What students say about the courses and the program"
        actions={
          <div className="flex gap-2">
            <Select value={course} onChange={(e) => setCourse(e.target.value)} className="w-60">
              <option value="all">All reviews</option>
              {targetOptions.groups.map(([id, name]) => (
                <option key={id} value={`group:${id}`}>
                  Group: {name}
                </option>
              ))}
              {targetOptions.courses.map(([id, title]) => (
                <option key={id} value={`course:${id}`}>
                  {title}
                </option>
              ))}
              <option value="general">Overall (general)</option>
            </Select>
            <Select value={stars} onChange={(e) => setStars(e.target.value)} className="w-32">
              <option value="all">All stars</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n > 1 ? 's' : ''}
                </option>
              ))}
            </Select>
          </div>
        }
      />

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
            <EmptyState icon={<MessageSquareHeart size={22} />} title="No matching reviews" description="Try a different course or star filter." />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <GlassCard key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-900">{r.student?.full_name || r.student?.email || 'Student'}</span>
                        <Badge tone={r.group ? 'amber' : r.course ? 'blue' : 'neutral'}>{r.group?.name ?? r.course?.title ?? 'Overall'}</Badge>
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
    </div>
  );
}
