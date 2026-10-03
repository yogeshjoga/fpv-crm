import { useEffect, useMemo, useState } from 'react';
import { MessageSquareHeart, Send, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery, unwrap } from '../../lib/useQuery';
import { GlassCard } from '../../components/ui/shared';
import { StarRating } from '../../components/StarRating';
import { Button, EmptyState, Field, PageHeader, Select, Spinner, TextArea, useToast } from '../../components/ui/kit';

interface MyReview {
  id: string;
  course_id: string | null;
  rating: number;
  comment: string;
  updated_at: string;
}
interface Enrolled {
  course: { id: string; title: string } | null;
}

const GENERAL = 'general';
const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export function Reviews() {
  const { profile } = useAuth();
  const toast = useToast();
  const [target, setTarget] = useState(GENERAL);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useQuery(async () => {
    const [reviews, enrolled] = await Promise.all([
      unwrap(supabase.from('reviews').select('id, course_id, rating, comment, updated_at').eq('student_id', profile!.id).order('updated_at', { ascending: false })) as Promise<MyReview[]>,
      unwrap(supabase.from('enrollments').select('course:courses(id, title)').eq('student_id', profile!.id).eq('status', 'active')) as unknown as Promise<Enrolled[]>,
    ]);
    return { reviews, courses: enrolled.map((e) => e.course).filter((c): c is { id: string; title: string } => !!c) };
  }, [profile?.id]);

  const reviews = useMemo(() => q.data?.reviews ?? [], [q.data]);
  const courses = useMemo(() => q.data?.courses ?? [], [q.data]);
  const titleFor = (courseId: string | null) => (courseId ? courses.find((c) => c.id === courseId)?.title ?? 'Course' : 'EgireRobotics overall');
  const existing = reviews.find((r) => (r.course_id ?? GENERAL) === target);

  // Picking a course you've already reviewed loads that review so you can edit it.
  useEffect(() => {
    setRating(existing?.rating ?? 0);
    setComment(existing?.comment ?? '');
  }, [existing?.id, existing?.rating, existing?.comment, target]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return toast('Pick a star rating first', 'error');
    setBusy(true);
    const payload = { rating, comment: comment.trim() };
    const { error } = existing
      ? await supabase.from('reviews').update(payload).eq('id', existing.id)
      : await supabase.from('reviews').insert({ ...payload, student_id: profile!.id, course_id: target === GENERAL ? null : target });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(existing ? 'Review updated — thank you!' : 'Thanks for your review!');
    q.refetch();
  };

  const remove = async (r: MyReview) => {
    if (!confirm('Delete this review?')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', r.id);
    if (error) return toast(error.message, 'error');
    if ((r.course_id ?? GENERAL) === target) {
      setRating(0);
      setComment('');
    }
    q.refetch();
  };

  if (q.loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Tell us how your learning is going — your honest feedback shapes the next batch" />

      <div className="grid gap-6 lg:grid-cols-5">
        <GlassCard className="p-5 lg:col-span-3">
          <form onSubmit={submit} className="space-y-4">
            <Field label="What are you reviewing?">
              <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value={GENERAL}>EgireRobotics overall</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Your rating" required>
              <div className="flex items-center gap-3">
                <StarRating value={rating} onChange={setRating} size={28} />
                <span className="text-sm text-neutral-500">{LABELS[rating]}</span>
              </div>
            </Field>
            <Field label="Your feedback" hint="What was useful, what was confusing, what should we improve? (optional)">
              <TextArea rows={5} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us in your own words…" />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">{existing ? 'You already reviewed this — saving will update it.' : 'Your instructors read every review.'}</span>
              <Button type="submit" loading={busy}>
                <Send size={14} /> {existing ? 'Update review' : 'Submit review'}
              </Button>
            </div>
          </form>
        </GlassCard>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Your reviews</h2>
          {!reviews.length ? (
            <EmptyState icon={<MessageSquareHeart size={22} />} title="No reviews yet" description="Your submitted reviews will show up here." />
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <GlassCard key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => setTarget(r.course_id ?? GENERAL)} className="min-w-0 text-left">
                      <div className="truncate text-sm font-medium text-neutral-900">{titleFor(r.course_id)}</div>
                      <div className="mt-1">
                        <StarRating value={r.rating} size={14} />
                      </div>
                    </button>
                    <Button variant="ghost" onClick={() => remove(r)} title="Delete review">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  {r.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{r.comment}</p>}
                  <div className="mt-2 text-[11px] text-neutral-400">{new Date(r.updated_at).toLocaleDateString()}</div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
